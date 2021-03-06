const async = require('async');
const Item = require('../models/item');
const Category = require('../models/category');

const { body, validationResult } = require('express-validator');
const password = process.env.ADMINPASSWORD || 'password';
const { upload } = require('../upload');

const fs = require('fs');
const path = require('path');


async function deleteImageIfExists(id) {
    const oldItem = await Item.findById(id);

    if (oldItem.filename) {
        fs.unlink(
            path.resolve(__dirname, '../public/images/' + oldItem.filename),
            function(err) {
                if (err) throw new Error(err);
            }
        );
    }
}


// Display all Items
exports.item_list = function(req, res, next) {
    Item.find()
        .sort([
            ['name', 'ascending']
        ])
        .populate('image')
        .exec(function(err, item_list) {
            if (err) { return next(err); }
            res.render('item_list', { item_list, });
        });
}

// Display Item Details
exports.item_details = function(req, res, next) {
    async.parallel({
        item: function(callback) {
            Item.findById(req.params.id)
                .populate('category')
                .populate('image')
                .exec(callback)
        },
    }, function(err, results) {
        if (err) { return next(err); }
        if (!results.item) {
            res.redirect('/inventory/items');
        } else {
            res.render('item_details', {...results, })
        }
    })
}


// Create Item
exports.item_create_get = function(req, res, next) {
    async.parallel({
        categories: function(callback) {
            Category.find(callback);
        },
    }, function(err, results) {
        if (err) { return next(err); }
        res.render('item_form', { title: 'New Item', ...results, });
    });
}

exports.item_create_post = [
    // image upload
    upload.single('image'),

    // validate fields
    body('name', 'Name must be specified').trim().isLength({ min: 1 }).escape(),
    body('description').trim().escape(),
    body('price', 'Price must be a number').trim().isLength({ min: 1 }).escape().isNumeric(),
    body('stock', 'Stock must be a number').trim().isLength({ min: 1 }).escape().isNumeric(),
    body('category').notEmpty().withMessage('category must be selected'),

    // convert category to array
    (req, res, next) => {
        if (!(req.body.category instanceof Array)) {
            req.body.category = new Array(req.body.category);
        }
        next();
    },

    // process request after sanitization
    (req, res, next) => {

        const errors = validationResult(req);

        const item = (req.file) ?
            new Item({
                ...req.body,
                ...req.file,
            }) :
            new Item({
                ...req.body,
            })

        if (!errors.isEmpty()) {
            // there are errors, rerender
            async.parallel({
                categories: function(callback) {
                    Category.find(callback);
                },
            }, function(err, results) {
                if (err) { return next(err); }

                results.categories.forEach(category => {
                    item.category.forEach(cat => {
                        if (category._id.toString() === cat._id.toString()) {
                            category.checked = 'true';
                        }
                    })
                })
                res.render('item_form', { title: 'New item', ...errors, item, ...results });
            })

        } else {
            item.save(function(err) {
                if (err) { return next(err); }
                // render item detail page
                res.redirect(item.url);
            })
        }
    }
]


// Delete Item
exports.item_delete_get = function(req, res, next) {
    async.parallel({
            item: function(callback) {
                Item.findById(req.params.id).exec(callback)
            },
        },
        function(err, results) {
            if (err) { return next(err); }
            if (!results.item) {
                res.redirect('/inventory/items');
            }
            res.render('item_delete', {...results, })
        })
}

exports.item_delete_post = async function(req, res, next) {
    if (req.body.password !== password) {
        var err = new Error('Invalid admin password');
        res.render('item_delete', { err, item: {...req.body }, })
    } else {
        await deleteImageIfExists(req.params.id);

        Item.findByIdAndRemove(req.params.id, function(err) {
            if (err) { return next(err); }
            res.redirect('/inventory/items');
        });
    }
}


// Update Item
exports.item_update_get = function(req, res, next) {
    async.parallel({
        item: function(callback) {
            Item.findById(req.params.id).populate('category image').exec(callback);
        },
        categories: function(callback) {
            Category.find(callback);
        }
    }, function(err, results) {
        if (err) { return next(err); }
        if (!results.item) {
            var err = new Error('No item found')
            err.status = 404;
            return next(err);
        } else {
            results.categories.forEach(category => {
                results.item.category.forEach(cat => {
                    if (category._id.toString() === cat._id.toString()) {
                        category.checked = 'true';
                    }
                })
            })
            res.render('item_form', { title: 'Update Item', ...results, requirePass: true, })
        }
    });
}


exports.item_update_post = [
    // image upload
    upload.single('image'),

    // sanitize and validate fields
    body('name', 'Name must be specified').trim().isLength({ min: 1 }).escape(),
    body('price', 'Price must be specified').trim().isLength({ min: 1 }).escape().isNumeric(),
    body('stock', 'Stock must be specified').trim().isLength({ min: 1 }).escape().isNumeric(),
    body('category').notEmpty().withMessage('category must be selected'),

    // convert category to array
    (req, res, next) => {
        if (!(req.body.category instanceof Array)) {
            req.body.category = new Array(req.body.category);
        }
        next();
    },

    // process request after sanitization
    async(req, res, next) => {
        const errors = validationResult(req);

        const item = new Item({
            ...req.body,
            ...req.file,
            filename: (req.file) ? req.file.filename : null,
            _id: req.params.id,
        })

        if (!errors.isEmpty() || req.body.password !== password) {
            // there are errors, rerender
            async.parallel({
                categories: function(callback) {
                    Category.find(callback);
                },
            }, function(err, results) {
                if (err) { return next(err); }

                results.categories.forEach(category => {
                    item.category.forEach(cat => {
                        if (category._id.toString() === cat._id.toString()) {
                            category.checked = 'true';
                        }
                    })
                })
                let passError;
                if (req.body.password !== password) {
                    passError = new Error('Invalid admin password');
                }
                res.render('item_form', { title: 'Update Item', ...results, item, ...errors, passError, requirePass: true, });
            });
        } else {

            // remove old image if selected, or new image
            if (req.body['remove-image'] || req.file) {
                await deleteImageIfExists(req.params.id);
            }

            Item.findByIdAndUpdate(req.params.id, item, {}, function(err, theitem) {
                if (err) { return next(err); }
                res.redirect(theitem.url);
            });
        }
    }
]