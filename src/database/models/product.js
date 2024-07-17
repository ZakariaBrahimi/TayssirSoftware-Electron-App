/* eslint-disable prettier/prettier */
/* eslint-disable no-unused-vars */
'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Product.belongsTo(models.Category, {
        foreignKey: 'categoryId',
        as: 'category'
      });
      Product.belongsTo(models.Brand, {
        foreignKey: 'brandId',
        as: 'brand'
      });
      Product.hasMany(models.Sale, {
        foreignKey: 'productId',
        as: 'sales'
      });
    }
  }
  Product.init({
    name: DataTypes.STRING,
    barcode: DataTypes.INTEGER,
    quantity: DataTypes.INTEGER,
    cost: DataTypes.INTEGER, // cost == cost
    price: DataTypes.INTEGER, // price == price
    categoryId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Categories', // refers to table name
        key: 'id', // refers to column name in referenced table
      }},
    brandId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Brands', // refers to table name
        key: 'id', // refers to column name in referenced table
      }},

  }, {
    sequelize,
    modelName: 'Product',

    // FIXME: when I change model name, sequelize creates a new table , instead of updating only the model name
  });
  return Product;
};