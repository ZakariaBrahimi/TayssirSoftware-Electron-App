# Create a medium post fro electrone
## Notes: 
- 
# tayssirsoft-electron-app

An Electron application with React

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```
#   T a y s s i r S o f t w a r e - E l e c t r o n - A p p 
 
 





# Notes


- The product Name should be unique on the database
    - because of the barcode generated from the name field

- SOOOO when user clicks on generate code button the function isNameValid will fire

- the barcode is required, so we need to define a function called isNameValid
- isNameValid(): - returns true if the new created product name is not already in the database
                 - otherwise returns false