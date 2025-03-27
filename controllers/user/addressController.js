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



const addAddress = async (req, res) =>{
    try {
        console.log( req.session.user);
        
        const userId = req.session.user.id;

        console.log(userId)

        if (!userId) {
            return res.json({ success: false, message: "User not authenticated" });
        }
        console.log(req.body);
        
        
        const {fullname,phone,street,city,landmark,state,zipCode} = req.body;

        console.log(req.body);
        

          console.log("2");
          
        const  newAddress = new Address({
            userId:userId,
            address:[

                {fullname:fullname,
                phone:phone,
                street:street,
                city:city,
                landmark:landmark,
                state:state,
                zipCode:zipCode,
                
            }
            ]

        });
        
        

        await newAddress.save();
        console.log("22");
        console.log(newAddress);
        

        
        res.json({success: true , message: "Address added successfully"});

    } catch (error) {
        console.error("error adding adress", error);
        res.json({success : false, message : "internal server error"});
        
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
  



module.exports = {
    getAddresses,
    addAddress,
    editAddress,
}

