const User = require('../../models/userSchema');
const Transaction = require('../../models/transactionSchema');

const getWalletPage = async (req, res) => {
    try {
        const userId = req.session.user.id;

        
        const user = await User.findById(userId)
            .select('wallet')  
            .lean();

        if (!user) {
            return res.status(404).send('User not found');
        }

        
        user.wallet = user.wallet || 0;

        
        const transactions = await Transaction.find({ userId })
            .sort({ createdAt: -1 })
            .lean();

        res.render('mywallet', {  
            user,
            transactions,
            title: 'My Wallet'
        });

    } catch (error) {
        console.error('Wallet page error:', error);
        res.status(500).send('Error loading wallet');
    }
};

module.exports = {
    getWalletPage
};