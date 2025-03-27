const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User", 
        required: true
    },
    address: [{
        fullname: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        street: {
            type: String,
            required: true
        },
        landmark: {
            type: String,
            required: true
        },
        state: {
            type: String,
            required: true
        },
        zipCode: {
            type: Number,
            required: true
        },
        phone: {
            type: String,
            required: true
        }
    }]
});

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;
