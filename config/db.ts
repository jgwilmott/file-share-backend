import mongoose from "mongoose";

const connectDB = async () => {
    try {
        await mongoose.connect(
            process.env.MONGO_URI as string
        )
    } catch (error) {
        console.log(
            "Connection Error ",
            error instanceof Error ? error.message : ''
        );
    }

    const connection = mongoose.connection;
    if (connection.readyState >= 1) {
        console.log("Connected to database");
        return;
    }
    connection.on("error", () => console.log("Connection failed"))
}

export default connectDB;