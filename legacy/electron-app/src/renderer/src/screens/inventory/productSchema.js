/* eslint-disable prettier/prettier */
import { z } from 'zod'

export const productSchema = z
  .object({
    userId: z.number().default(() => {
      const userSession = localStorage.getItem('userSession')
      return userSession ? JSON.parse(userSession).user.id : ''
    }),
    name: z
      .string()
      .min(1, 'Product name is required') // Required field
      .regex(/^[A-Za-z].*$/, 'Name must start with a letter'), // First letter must be an alphabet
    // codeBar: z.string().min(1, "Product barcode is required"), // Required field
    description: z.string().optional(), // Description is optional
    cost: z.preprocess(
      (val) => Number(val) || 0, // Convert input to number because React Hook Form treats input values as strings
      z.number().min(1, 'Product cost is required')
    ),
    price: z.preprocess(
      (val) => Number(val) || 0, // Convert input to number
      z.number().min(1, 'Product price is required')
    ),
    quantity: z.preprocess(
      (val) => Number(val) || 0, // Convert input to number
      z.number().min(1, 'Product quantity is required')
    ),
    // barCode: z.preprocess(
    //   (value) => {
    //     const num = Number(value);
    //     return num; // Convert value to number
    //   },
    //   z.number({ invalid_type_error: "Barcode must be a number" })
    //   .min(1, "Barcode is required") // Ensures it's greater than 0 and required
    //   // .int("Barcode must be an integer") // Ensures it's a whole number
    // ),
    barCode: z.string().nonempty("Barcode is required").default(""), // .default("") to Ensure It's Always a String

    categoryId: z.number().optional(),
    brandId: z.number().optional()
  })
  .refine((data) => data.price >= data.cost, {
    message: 'Price must be greater than or equal to cost',
    path: ['price'] // Attach error to the 'price' field
  })
