import express from 'express';
import multer from 'multer';
import File from '../models/File';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import https from "https";
import nodemailer from 'nodemailer';
import createEmailTemplate from '../utils/createEmailTemplate';


const router = express.Router();
const storage = multer.diskStorage({});
let upload = multer({
  storage
});

router.post("/upload", upload.single("myFile"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ message: "File needed!" });

    console.log(req.file);

    let uploadedFile: UploadApiResponse;
    try {
      uploadedFile = await cloudinary.uploader.upload(req.file.path, {
        folder: "sharemeYT",
        resource_type: "auto"
      });
    } catch (error) {
      console.log(
        error instanceof Error ? error.message : ''
      );
      return res.status(400).json({ message: "Cloudinary Error" });
    }

    const { originalname } = req.file;
    const { secure_url, bytes, format } = uploadedFile;

    const file = await File.create({
      filename: originalname,
      sizeInBytes: bytes,
      secure_url,
      format
    });
    res.status(200).json({
      id: file._id,
      downloadPageLink: `${process.env.API_BASE_ENDPOINT_CLIENT}/download/${file._id}`,
    });
  } catch (error) {
    console.log(error instanceof Error ? error.message : '');
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const file = await File.findById(id);
    if (!file)
      return res.status(404).json({ message: "File does not exist" });

    const { filename, format, sizeInBytes } = file;
    return res.status(200).json({
      name: filename,
      sizeInBytes,
      format,
      id,
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const id = req.params.id;
    const file = await File.findById(id);
    if (!file)
      return res.status(404).json({ message: "File does not exist" });

    https.get(file.secure_url, (fileStream) =>
      fileStream.pipe(res)
    );

  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

router.post("/email", async (req, res) => {
  // validate request
  const { id, emailFrom, emailTo } = req.body;

  // check if file exists
  const file = await File.findById(id);
  if (!file)
    return res.status(404).json({ message: "File does not exist" });

  // create transporter (takes an object to define a connection)
  let transporter = nodemailer.createTransport({
    // @ts-ignore
    host: process.env.BREVO_SMTP_HOST,
    port: process.env.BREVO_SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_PASSWORD,
    }
  });

  // prepare email data
  const { filename: fileName, sizeInBytes } = file;
  const fileSize = `${(Number(sizeInBytes) / (1024 * 1024)).toFixed(2)} MB`;
  const downloadPageLink = `${process.env.API_BASE_ENDPOINT_CLIENT}/download/${id}`;

  const mailOptions = {
    from: emailFrom, // sender address
    to: emailTo, // list of receivers
    subject: "File shared with you", // Subject line
    text: `${emailFrom} shared a file with you`, // plain text body
    html: createEmailTemplate(emailFrom, downloadPageLink, fileName, fileSize), // html body
  };

  // send email using the transporter 
  transporter.sendMail(mailOptions, async (error, info) => {
    if (error) {
      console.log(error);
      return res.status(500).json({
        message: "Server Error"
      });
    }

    file.sender = emailFrom;
    file.receiver = emailTo;

    // save the data and send the response 
    await file.save();
    return res.status(200).json({
      message: "Email Sent"
    });
  });
});
export default router;