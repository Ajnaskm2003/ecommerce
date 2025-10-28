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
            let now = new Date();
            let startDate;
            if (period === 'day') {
                startDate = new Date(now.setDate(now.getDate() - 1));
            } else if (period === 'week') {
                startDate = new Date(now.setDate(now.getDate() - 7));
            } else if (period === 'month') {
                startDate = new Date(now.setMonth(now.getMonth() - 1));
            }
            if (startDate) {
                filter.createdOn = { $gte: startDate };
            }
        }

        console.log('Filter applied:', filter);
        const orders = await Order.find(filter)
            .populate('orderItems.product', 'productName')
            .sort({ createdOn: -1 });

        console.log('Fetched orders:', orders.length);

        const sales = orders.map(order => ({
            orderId: order.orderId,
            items: order.orderItems.map(item => ({
                name: item.product?.productName || 'Product Deleted',
                quantity: item.quantity,
            })),
            price: order.totalAmount,
            date: order.createdOn
        }));

        console.log('Sales data:', sales);
        res.set('Cache-Control', 'no-store');
        res.render('salesReport', { sales, query: req.query });
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
        $lte: new Date(to + "T23:59:59"),
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
      .populate("orderItems.product", "productName")
      .sort({ createdOn: -1 });

    const doc = new PDFDocument({ margin: 30, size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");

    doc.pipe(res);

    
    doc.fontSize(18).fillColor("#333").text("Sales Report", { align: "center" });
    doc.moveDown(2);

    
   
    const tableTop = doc.y;
    const orderIdX = 50;
    const dateX = 150;
    const totalPriceX = 300;
    const itemsX = 400;

    doc.fontSize(10).fillColor("#fff");
    doc.rect(orderIdX, tableTop, 500, 20).fill("#007BFF").stroke();
    doc.fillColor("#fff").text("Order ID", orderIdX + 5, tableTop + 5);
    doc.text("Date", dateX + 5, tableTop + 5);
    doc.text("Total Price", totalPriceX + 5, tableTop + 5);
    doc.text("Items", itemsX + 5, tableTop + 5);

    doc.moveDown(1.5);

    
    doc.fillColor("#000");

    
    let currentY = tableTop + 25;
    orders.forEach((order, i) => {
      const itemsText = order.orderItems
        .map(item => `${item.product?.productName || "Deleted"} x${item.quantity}`)
        .join(", ");
      
      
      const rowHeight = Math.max(
        doc.heightOfString(order.orderId, { width: 90 }) + 10,
        doc.heightOfString(order.createdOn.toDateString(), { width: 140 }) + 10,
        doc.heightOfString(`₹${order.totalAmount.toFixed(2)}`, { width: 90 }) + 10,
        doc.heightOfString(itemsText, { width: 140 }) + 10
      );

      doc.fontSize(10);
      doc.text(order.orderId, orderIdX + 5, currentY, { width: 90 });
      doc.text(order.createdOn.toDateString(), dateX + 5, currentY, { width: 140 });
      doc.text(`₹${order.totalAmount.toFixed(2)}`, totalPriceX + 5, currentY, { width: 90 });
      doc.text(itemsText, itemsX + 5, currentY, { width: 140 });

      
      doc.moveTo(orderIdX, currentY + rowHeight)
        .lineTo(orderIdX + 500, currentY + rowHeight)
        .strokeColor("#ddd")
        .stroke();

      currentY += rowHeight + 5;
    });

    
    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    doc.moveDown(2);
    doc.fontSize(12).fillColor("#000").text("Summary:", { align: "left" });
    doc.text(`Total Orders: ${totalOrders}`);
    doc.text(`Total Sales: ₹${totalAmount.toFixed(2)}`);

    doc.end();
  } catch (error) {
    console.error("Error downloading report:", error.message);
    res.status(500).send("Failed to download sales report.");
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


