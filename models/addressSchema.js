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
            required: [true, 'Full name is required']
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            validate: {
                validator: function(v) {
                    return /^\d{10}$/.test(v);
                },
                message: props => `${props.value} is not a valid phone number! Please enter a 10-digit number.`
            }
        },
        street: {
            type: String,
            required: [true, 'Street address is required']
        },
        city: {
            type: String,
            required: [true, 'City is required']
        },
        landmark: {
            type: String,
            default: ''  // Make landmark optional with empty default
        },
        state: {
            type: String,
            required: [true, 'State is required']
        },
        zipCode: {
            type: Number,
            required: [true, 'Zip code is required']
        }
    }]
}, {
    timestamps: true
});

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;
