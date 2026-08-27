require("dotenv").config();
const mongoose =require('mongoose');
const mongoUrl=process.env.MONGO_URL;




const connectMongoDb = async () => {
  try {
    await mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 8000 });
    console.log("Connect Database");
  } catch (err) {
    console.log("Database connection error", err);
  }
};
module.exports=connectMongoDb;