/* eslint-disable prettier/prettier */
/* eslint-disable no-unused-vars */
'use strict';
const {
  Model
} = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Brand extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Brand.hasMany(models.Product, {
        foreignKey: 'brandId',
        as: 'products'
      });
    }
  }
  Brand.init({
    name: DataTypes.STRING,
  }, {
    sequelize,
    modelName: 'Brand',
    // FIXME: when I change model name, sequelize creates a new table , instead of updating only the model name
  });
  return Brand;
};