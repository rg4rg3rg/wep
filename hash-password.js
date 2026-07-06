"use strict";

const bcrypt = require("bcryptjs");

const password = process.argv[2];

if (!password) {
  console.error('Kullanım: npm run hash-password -- "güçlü-şifreniz"');
  process.exit(1);
}

if (password.length < 12) {
  console.error("Şifre en az 12 karakter olmalıdır.");
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 12));
