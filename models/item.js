const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const ItemSchema = new Schema({
    name: {
        type: String,
        required: true,
        maxlength: 300
    },
    description: {
        type: String,
        maxlength: 300
    },
    price: {
        type: Number,
        required: true
    },
    stock: {
        type: Number,
        required: true
    },
    category: [{
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    }],
    filename: {
        type: String,
    },
    mimetype: {
        type: String,
    },
}, );

// Virtual for item's URL
ItemSchema
    .virtual('url')
    .get(function() {
        return '/inventory/item/' + this._id;
    });

// Virtual for image's URL
ItemSchema.virtual('imageurl').get(function() {
    return '/images/' + this.filename;
});

// Virtual for item's price
ItemSchema
    .virtual('formattedPrice')
    .get(function() {
        return '$' + this.price;
    });

//Export model
module.exports = mongoose.model('Item', ItemSchema);