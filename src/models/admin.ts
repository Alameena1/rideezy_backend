import mongoose from "mongoose";

const AdminSchema = new mongoose.Schema({
  email: "alameena8841@gmail.com",
  password:"Al@12345",

});

const AdminModal = mongoose.model("admin", AdminSchema);
export default AdminModal;
 