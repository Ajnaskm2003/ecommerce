const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');




const getAddresses = async (req,res)=>{
    try {
        
        const userId = req.session.user.id;
        const addresses = await Address.find({ userId });
        console.log(addresses);
        

        res.render('myaddress',{
            addresses: addresses,
        })

    } catch (error) {
        
    }
};



const addAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;
        if (!userId) {
            return res.json({ success: false, message: "User not authenticated" });
        }

        const {fullname, phone, street, city, landmark = '', state, zipCode} = req.body;

        // Validate required fields
        if (!fullname || !phone || !street || !city || !state || !zipCode) {
            return res.json({ 
                success: false, 
                message: "Please fill all required fields" 
            });
        }

        const newAddress = new Address({
            userId: userId,
            address: [{
                fullname,
                phone,
                street,
                city,
                landmark, // Now optional
                state,
                zipCode
            }]
        });

        await newAddress.save();
        
        return res.json({
            success: true, 
            message: "Address added successfully"
        });

    } catch (error) {
        console.error("Error adding address:", error);
        return res.json({
            success: false, 
            message: error.message || "Failed to add address"
        });
    }
};

const editAddress = async (req, res) => {
    try {
      const { id, fullname, city, street, landmark, state, zipCode, phone } = req.body;

      console.log('req.body-====================',req.body)
  
      
      const addressDoc = await Address.findOne({ "address._id": id });

      console.log(addressDoc)
  
      if (!addressDoc) {
        return res.status(404).json({ success: false, message: "Address not found." });
      }
  
     
      const addressToUpdate = addressDoc.address.id(id);

      console.log('-------',addressToUpdate)
  
      if (!addressToUpdate) {
        return res.status(404).json({ success: false, message: "Address not found." });
      }
  
      
      addressToUpdate.fullname = fullname;
      addressToUpdate.city = city;
      addressToUpdate.street = street;
      addressToUpdate.landmark = landmark;
      addressToUpdate.state = state;
      addressToUpdate.zipCode = zipCode;
      addressToUpdate.phone = phone;
  
      
      await addressDoc.save();


      console.log("-------------------------------");
      
  
      res.status(200).json({ success: true, message: "Address updated successfully!" });
    } catch (error) {
      console.error("Error updating address:", error);
      res.status(500).json({ success: false, message: "Failed to update address." });
    }
  };



  const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        const { addressId } = req.params;

        if (!userId) {
            return res.status(401).json({ 
                success: false, 
                message: "Please login to continue" 
            });
        }

        if (!addressId) {
            return res.status(400).json({
                success: false,
                message: "Address ID is required"
            });
        }

      
        const result = await Address.findOneAndUpdate(
            { userId },
            { $pull: { address: { _id: addressId } } },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ 
                success: false, 
                message: "Address not found" 
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: "Address deleted successfully" 
        });

    } catch (error) {
        console.error("Error deleting address:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to delete address" 
        });
    }
};



module.exports = {
    getAddresses,
    addAddress,
    editAddress,
    deleteAddress
}

