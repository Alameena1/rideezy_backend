const bcrypt = require("bcrypt");
bcrypt.hash("Al@12345", 10, (err, hash) => {
  if (err) console.error(err);
  console.log("hashed: ",hash);
});