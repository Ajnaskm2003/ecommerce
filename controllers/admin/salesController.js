const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');  
const ExcelJS = require('exceljs');


const getSalesReport = async (req, res) => {
    try {
        const { period, from, to } = req.query;
        let filter = { status: "Delivered" };

    
        if (from && to) {
            filter.createdOn = {
                $gte: new Date(from),
                $lte: new Date(to + "T23:59:59")
            };
        } else if (period) {
            const now = new Date();
            let startDate;
            if (period === 'day') {
                startDate = new Date(now.setDate(now.getDate() - 1));
            } else if (period === 'week') {
                startDate = new Date(now.setDate(now.getDate() - 7));
            } else if (period === 'month') {
                startDate = new Date(now.setMonth(now.getMonth() - 1));
            }
            if (startDate) filter.createdOn = { $gte: startDate };
        }

        console.log('filterrrr applly:', filter);

        
        const orders = await Order.find(filter)
            .populate('orderItems.product', 'productName')
            .sort({ createdOn: -1 });

        console.log('geting orders:', orders.length);

        
        const sales = orders.map(order => ({
            orderId: order.orderId,
            items: order.orderItems.map(item => ({
                name: item.product?.productName || 'Product Deleted',
                quantity: item.quantity,
            })),
            price: order.totalAmount,
            discount: order.discount || 0,
            date: order.createdOn
        }));

    
        const orderCount   = orders.length;
        const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
        const totalDiscount = orders.reduce((sum, o) => sum + (o.discount || 0), 0);

        console.log('Aggregates ->', { orderCount, totalRevenue, totalDiscount });

        res.set('Cache-Control', 'no-store');
        res.render('salesReport', {
            sales,
            query: req.query,
            summary: { orderCount, totalRevenue, totalDiscount }
        });

    } catch (error) {
        console.error('Error loading sales report:', error.message, error.stack);
        res.status(500).render('error', { message: 'Failed to load sales report. Please try again later.' });
    }
};

const downloadSalesReport = async (req, res) => {
  try {
    const { period, from, to } = req.query;
    let filter = { status: "Delivered" };

    if (from && to) {
      filter.createdOn = {
        $gte: new Date(from),
        $lte: new Date(to + "T23:59:59.999Z"),
      };
    } else if (period) {
      let now = new Date();
      let startDate;

      if (period === "day") {
        startDate = new Date(now.setDate(now.getDate() - 1));
      } else if (period === "week") {
        startDate = new Date(now.setDate(now.getDate() - 7));
      } else if (period === "month") {
        startDate = new Date(now.setMonth(now.getMonth() - 1));
      }

      if (startDate) filter.createdOn = { $gte: startDate };
    }

    const orders = await Order.find(filter)
      .populate("orderItems.product", "productName")
      .sort({ createdOn: -1 });

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${new Date().toISOString().slice(0, 10)}.pdf`
    );

    doc.pipe(res);

    // Title
    doc
      .fontSize(24)
      .fillColor("#2c3e50")
      .text("Sales Report", { align: "center" });
    
    doc
      .fontSize(12)
      .fillColor("#7f8c8d")
      .text(
        `Generated on: ${new Date().toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })}`,
        { align: "center" }
      );

    doc.moveDown(2);

    // Table Headers
    const tableTop = doc.y;
    const col1 = 50;   // Date
    const col2 = 140;  // Items
    const col3 = 320;  // Total Amount
    const col4 = 400;  // Discount
    const col5 = 480;  // Revenue

    // Header Background
    doc
      .rect(50, tableTop, 500, 25)
      .fill("#3498db")
      .stroke();

    doc.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold");

    doc.text("Date", col1 + 5, tableTop + 7);
    doc.text("Items Ordered", col2 + 5, tableTop + 7, { width: 170 });
    doc.text("Total Amount", col3 + 5, tableTop + 7, { align: "right" });
    doc.text("Discount", col4 + 5, tableTop + 7, { align: "right" });
    doc.text("Revenue", col5 + 5, tableTop + 7, { align: "right" });

    let yPosition = tableTop + 30;

    let totalAmount = 0;
    let totalDiscount = 0;
    let netRevenue = 0;

    orders.forEach((order, index) => {
      const itemsText = order.orderItems
        .map(
          (item) =>
            `${item.product?.productName || "Product Deleted"} x${item.quantity}`
        )
        .join(", ");

      const orderTotal = order.totalAmount || 0;
      const orderDiscount = order.discount || 0;
      const revenue = orderTotal - orderDiscount;

      totalAmount += orderTotal;
      totalDiscount += orderDiscount;
      netRevenue += revenue;

      // Alternating row background
      if (index % 2 === 0) {
        doc
          .rect(50, yPosition - 3, 500, 30)
          .fill("#f8f9fa")
          .stroke();
      }

      const rowHeight = Math.max(
        30,
        doc.heightOfString(itemsText, { width: 170 }) + 15
      );

      doc.fillColor("#2c3e50").fontSize(10).font("Helvetica");

      // Date
      doc.text(
        new Date(order.createdOn).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        col1 + 5,
        yPosition + 5
      );

      // Items
      doc.text(itemsText, col2 + 5, yPosition + 5, {
        width: 170,
        lineGap: 2,
      });

      // Amounts (right aligned)
      doc.text(`₹${orderTotal.toFixed(2)}`, col3 + 5, yPosition + 5, {
        width: 70,
        align: "right",
      });
      doc.text(`₹${orderDiscount.toFixed(2)}`, col4 + 5, yPosition + 5, {
        width: 70,
        align: "right",
      });
      doc.fillColor("#27ae60").font("Helvetica-Bold");
      doc.text(`₹${revenue.toFixed(2)}`, col5 + 5, yPosition + 5, {
        width: 70,
        align: "right",
      });

      // Bottom line
      doc
        .moveTo(50, yPosition + rowHeight + 5)
        .lineTo(550, yPosition + rowHeight + 5)
        .lineWidth(0.5)
        .strokeColor("#bdc3c7")
        .stroke();

      yPosition += rowHeight + 10;

      // Page break if needed
      if (yPosition > 750) {
        doc.addPage();
        yPosition = 50;
      }
    });

    // Summary Section
    doc.moveDown(3);
    doc
      .rect(50, doc.y, 500, 80)
      .fill("#ecf0f1")
      .stroke();

    doc.fillColor("#2c3e50").fontSize(14).font("Helvetica-Bold");
    doc.text("Summary", 60, doc.y + 15);

    doc.fontSize(12).font("Helvetica");
    doc.text(`Total Orders Delivered: ${orders.length}`, 60, doc.y + 25);
    doc.text(`Gross Sales (Total Amount):     ₹${totalAmount.toFixed(2)}`, 60, doc.y + 45);
    doc.text(`Total Discount Given:           - ₹${totalDiscount.toFixed(2)}`, 60, doc.y + 65);

    doc.fillColor("#e74c3c").font("Helvetica-Bold");
    doc.text(`Net Revenue:                    ₹${netRevenue.toFixed(2)}`, 60, doc.y + 90);

    // Footer
    doc.moveDown(5);
    doc
      .fontSize(10)
      .fillColor("#95a5a6")
      .text("Thank you for your business!", { align: "center" });

    doc.end();
  } catch (error) {
    console.error("Error generating sales report:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate sales report" });
    }
  }
};


const downloadSalesReportExcel = async (req, res) => {
    try {
        const { period, from, to } = req.query;
        let filter = { status: 'Delivered' };

        
        if (from && to) {
            filter.createdOn = {
                $gte: new Date(from),
                $lte: new Date(to + "T23:59:59")
            };
        } else if (period) {
            let now = new Date();
            let startDate;

            if (period === 'day') {
                startDate = new Date(now.setDate(now.getDate() - 1));
            } else if (period === 'week') {
                startDate = new Date(now.setDate(now.getDate() - 7));
            } else if (period === 'month') {
                startDate = new Date(now.setMonth(now.getMonth() - 1));
            }

            if (startDate) filter.createdOn = { $gte: startDate };
        }

        const orders = await Order.find(filter)
            .populate('orderItems.product', 'productName') 
            .sort({ createdOn: -1 });

        if (!orders || orders.length === 0) {
            return res.status(404).send("No sales data found");
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sales Report");

        
        worksheet.mergeCells("A1", "D1");
        worksheet.getCell("A1").value = "Sales Report";
        worksheet.getCell("A1").alignment = { horizontal: "center" };
        worksheet.getCell("A1").font = { size: 16, bold: true };

       
        worksheet.addRow([]);
        worksheet.addRow(["Order ID", "Order Items", "Date", "Sales Price"]);

        
        worksheet.getRow(3).eachCell(cell => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: "center" };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFD9EAD3" }
            };
        });

        
        orders.forEach(order => {
            const items = order.orderItems
                .map(item => `${item.product?.productName || 'Deleted Product'} (x${item.quantity})`)
                .join(", ");

            worksheet.addRow([
                order.orderId,
                items,
                new Date(order.createdOn).toLocaleDateString("en-GB"),
                order.totalAmount
            ]);
        });

       
        worksheet.columns.forEach(column => {
            column.width = 25;
        });

        
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=SalesReport.xlsx"
        );

       
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error("Error downloading sales report Excel:", error);
        res.status(500).send("Error generating Excel report");
    }
};

module.exports = {
    getSalesReport,
    downloadSalesReport,
    downloadSalesReportExcel
}


