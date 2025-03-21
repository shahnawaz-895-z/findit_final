import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { User } from './userdetail.js';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read the frontend URL from environment
const frontendURL = process.env.FRONTEND_URL;

// Configure email transport with enhanced security options
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  },
  debug: true // Enable debugging
});

// Verify email configuration on startup
transporter.verify(function(error, success) {
  if (error) {
    console.error('Email configuration error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Test route to verify API is accessible
router.get('/test', (req, res) => {
  res.json({
    status: 'success',

// Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    console.log('Received forgot password request:', req.body);
    const { email } = req.body;
    
    if (!email) {
      console.log('Email is missing in request');
      return res.status(400).json({
        status: 'error',
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(200).json({
        status: 'success',
        message: 'If a user with that email exists, a password reset link has been sent.'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiration = new Date();
    resetTokenExpiration.setHours(resetTokenExpiration.getHours() + 1);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpiration;
    await user.save();

    // Use both deep linking scheme and web URL for better compatibility
    const resetURLApp = `findit://reset-password/${resetToken}`;
    const resetURLWeb = `${frontendURL}/reset-password/${resetToken}`;
    
    console.log('Generated reset URLs:', { app: resetURLApp, web: resetURLWeb });

    const mailOptions = {
      from: {
        name: 'FindIt App',
        address: process.env.EMAIL_FROM
      },
      to: user.email,
      subject: 'Password Reset Request - FindIt App',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b0b40;">Password Reset</h1>
          <p>You requested a password reset for your FindIt account.</p>
          <p>Please click one of the buttons below to reset your password. The link is valid for 1 hour.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetURLApp}" 
               style="background-color: #3b0b40; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 5px;
                      display: inline-block;
                      margin: 0 10px;">
              Reset in App
            </a>
            <a href="${resetURLWeb}" 
               style="background-color: #3b0b40; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 5px;
                      display: inline-block;
                      margin: 0 10px;">
              Reset in Browser
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">If you did not request this, please ignore this email and your password will remain unchanged.</p>
          <p style="color: #666; font-size: 14px;">If the buttons don't work, copy and paste one of these URLs into your browser:</p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">Mobile App: ${resetURLApp}</p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">Web Browser: ${resetURLWeb}</p>
        </div>
      `
    };

    try {
      console.log('Attempting to send email to:', user.email);
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.response);
      res.status(200).json({
        status: 'success',
        message: 'Password reset email sent'
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      throw new Error(`Failed to send reset email: ${emailError.message}`);
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error processing password reset',
      details: error.message
    });
  }
});

// Verify reset token
router.get('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Password reset token is invalid or has expired'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Token is valid',
      userId: user._id
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error verifying reset token'
    });
  }
});

// Reset password
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        status: 'error',
        message: 'Password is required'
      });
    }
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        status: 'error',
        message: 'Password reset token is invalid or has expired'
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Password has been reset successfully'
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Server error resetting password',
      details: error.message
    });
  }
});

export default router;
