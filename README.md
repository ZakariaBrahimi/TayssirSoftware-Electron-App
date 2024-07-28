# Tayssir POS Software

Tayssir POS (Point of Sale) Software is a comprehensive and efficient solution for managing sales, inventory, and customer interactions. Built with modern technologies such as Electron.js, React.js, Shadcn, Sequelize, and PostgreSQL, it provides a seamless experience for businesses of all sizes.

## Features

- **Sales Management**: Easily handle sales transactions, generate receipts, and manage customer data.
- **Inventory Management**: Track stock levels, manage product details, and receive alerts for low stock.
- **Reporting**: Generate detailed reports on sales, inventory, and customer behavior.
- **Barcode Generation**: Automatically generate and print barcodes for products.
- **User Authentication**: Secure user login and role-based access control.

## Technologies Used

- **Electron.js**: For creating the desktop application.
- **React.js**: For building the user interface.
- **Shadcn**: For UI components and design system.
- **Sequelize**: For interacting with the PostgreSQL database.
- **PostgreSQL**: For storing application data.

## Getting Started

### Prerequisites

Ensure you have the following installed on your system:

- Node.js (version 14 or higher)
- PostgreSQL

### Installation

1. **Clone the Repository**

   ```sh
   git clone https://github.com/your-username/tayssir-pos-software.git
   cd tayssir-pos-software
   ```

2. **Install Dependencies**

   ```sh
   npm install
   ```

3. **Set Up Environment Variables**

   Create a `.env` file in the root of your project and add the following variables:

   ```env
   DATABASE_URL=postgres://user:password@localhost:5432/tayssir_pos
   ```

4. **Run Database Migrations**

   ```sh
   npx sequelize-cli db:migrate
   ```

5. **Start the Application**

   ```sh
   npm start
   ```

## Usage

Once the application is running, you can access the following features:

- **Dashboard**: Get an overview of your sales and inventory status.
- **Sales**: Process new sales transactions and print receipts.
- **Inventory**: Add, update, or delete products from your inventory.
- **Reports**: Generate and view detailed reports.

## Next Features to Add
- **Dynamic Input fields**: User can add any form field to the product creation form.
- **To Do List**: User can write down today's tasks easily.

## Contributing

We welcome contributions from the community! To contribute:

1. Fork the repository.
2. Create a new branch (`git checkout -b feature/your-feature-name`).
3. Make your changes.
4. Commit your changes (`git commit -m 'Add some feature'`).
5. Push to the branch (`git push origin feature/your-feature-name`).
6. Open a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For any inquiries or support, please contact:

- **Email**: support@tayssir.com
- **Website**: [www.tayssir.com](http://www.tayssir.com)