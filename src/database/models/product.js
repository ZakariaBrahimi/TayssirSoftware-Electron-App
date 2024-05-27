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
    }
  }
  Product.init({
    name: DataTypes.STRING,
    quantity: DataTypes.INTEGER,
    purchasing_price: DataTypes.INTEGER,
    selling_price: DataTypes.INTEGER
  }, {
    sequelize,
    modelName: 'Product',
    // FIXME: when I change model name, sequelize creates a new table , instead of updating only the model name
  });
  return Product;
};