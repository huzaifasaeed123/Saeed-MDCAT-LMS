const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find();
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { fullName, email, contactNumber, password, role } = req.body;

    // Check if user already exists
    let existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      contactNumber,
      password,
      role
    });

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    let user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const { password, ...otherFields } = req.body;
    
    // Create update object with all fields except password
    const updateData = { ...otherFields };
    
    // If password is provided and not empty, include it in the update
    if (password && password.trim() !== '') {
      updateData.password = password;
    }
    
    // Update user - findByIdAndUpdate would bypass our password hashing
    // so we use findById + save to ensure pre-save hooks run
    if (updateData.password) {
      // If we're updating password, use this approach to trigger the pre-save hook
      user.fullName = updateData.fullName || user.fullName;
      user.email = updateData.email || user.email;
      user.contactNumber = updateData.contactNumber || user.contactNumber;
      user.role = updateData.role || user.role;
      user.password = updateData.password;
      
      await user.save();
    } else {
      // If no password update, we can use findByIdAndUpdate
      user = await User.findByIdAndUpdate(
        req.params.id,
        updateData,
        {
          new: true,
          runValidators: true
        }
      );
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};
// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    await user.deleteOne(); // Changed from remove() which is deprecated
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// By Default Admin User that creates when App will run 
exports.createAdminUser = async () => {
  try {
    // Check if admin environment variables are set
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminFullName = process.env.ADMIN_FULLNAME;
    const adminContact = process.env.ADMIN_CONTACT;
    
    if (!adminEmail || !adminPassword) {
      console.log('Admin credentials not found in environment variables, skipping admin creation.');
      return;
    }
    
    // Check if admin user already exists
    const adminExists = await User.findOne({ email: adminEmail });
    
    if (adminExists) {
      console.log('Admin user already exists, skipping admin creation.');
      return;
    }
    
    // Create admin user - use the User model directly
    // This will trigger the pre-save hook that hashes the password
    const admin = await User.create({
      fullName: adminFullName || 'System Admin',
      email: adminEmail,
      contactNumber: adminContact || '+123456789',
      password: adminPassword, // The pre-save hook will hash this
      role: 'admin'
    });
    
    console.log(`Admin user created: ${admin.email}`);
  } catch (error) {
    console.error('Error creating admin user:', error.message);
  }
};


//The Following Function will used to update their Own Profile

exports.updateProfile = async (req, res) => {
  try {
    // Get user ID from authenticated user
    const userId = req.user.id;
    
    // Only allow updating specific fields for regular users
    const { fullName, contactNumber, password } = req.body;
    
    // Create update object with permitted fields
    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (contactNumber) updateData.contactNumber = contactNumber;
    
    // Handle password update if provided
    if (password && password.trim() !== '') {
      // For password update, we need to fetch the user and use save()
      // to trigger the password hashing middleware
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      user.fullName = fullName || user.fullName;
      user.contactNumber = contactNumber || user.contactNumber;
      user.password = password;
      
      await user.save();
      
      return res.status(200).json({
        success: true,
        data: user
      });
    }
    
    // If no password update, use findByIdAndUpdate
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};