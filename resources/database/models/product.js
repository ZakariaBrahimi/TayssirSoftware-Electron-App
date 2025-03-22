/* eslint-disable prettier/prettier */
/* eslint-disable no-unused-vars */
'use strict'

const { Model } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    /**
     * Define associations between models.
     */
    static associate(models) {
      Product.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user'
      })

      Product.belongsTo(models.Category, {
        foreignKey: 'categoryId',
        as: 'category'
      })

      Product.belongsTo(models.Brand, {
        foreignKey: 'brandId',
        as: 'brand'
      })

      Product.hasMany(models.Sale, {
        foreignKey: 'productId',
        as: 'sales'
      })
    }
  }

  Product.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
      },
      barCode: {
        type: DataTypes.STRING, // Ensure it's stored as a STRING
        allowNull: false, // Required field
        unique: true // Must be unique
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      cost: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      price: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      categoryId: {
        type: DataTypes.INTEGER,
        references: {
          model: 'Categories', // Refers to the table name
          key: 'id'
        }
      },
      brandId: {
        type: DataTypes.INTEGER,
        references: {
          model: 'Brands', // Refers to the table name
          key: 'id'
        }
      },
      userId: {
        type: DataTypes.INTEGER, // Fixed incorrect wrapping
        allowNull: false,
        references: {
          model: 'Users', // Refers to the table name
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      }
    },
    {
      sequelize,
      modelName: 'Product',
      tableName: 'Products', // Explicitly define table name to prevent recreation issues
      timestamps: true // Optional: enables `createdAt` & `updatedAt` columns
    }
  )

  return Product
}
