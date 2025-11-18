const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    phone: {
        type: String,
        required: false,
        unique: false,
        sparse: true,
        default: null,
    },
    password: {
        type: String,
        required: false,
    },
    image: {
        type: String,  
        default: null, 
    },
    isBlocked: {
        type: Boolean,
        default: false,
    },
    isAdmin: {
        type: Boolean,
        default: false,
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: "Cart",
    }],
    wallet: {
        type: Number,
        default: 0,
        min: 0
    },
    walletHistory: [{
        amount: {
            type: Number,
            required: true,
        },
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true,
        },
        description: {
            type: String,
            default: "", 
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: "Order",
            default: null,
        },
        createdOn: {
            type: Date,
            default: Date.now,
        }
    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist",
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order",
    }],

    // ❌ removed old createdOn because timestamps will create createdAt

    referralCode: { 
        type: String,
    },
    redeemed: {
        type: Boolean,
        default: false,
    },
    redeemedUsers: [{
        type: Schema.Types.ObjectId,
        ref: "User",
    }],
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
        brand: {
            type: String,
        },
        searchedOn: {
            type: Date,
            default: Date.now,
        }
    }],
    usedCoupons: [{ 
        type: String 
    }],
}, { 
    timestamps: true  
});

userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

const User = mongoose.model("User", userSchema);

// User.collection.dropIndex("googleId_1").catch(err => {
//     if (err.codeName !== "NamespaceNotFound") {
//         console.error("Error dropping index:", err);
//     }
// });

module.exports = User;
