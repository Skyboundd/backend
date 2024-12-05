// routes/handler.js
const admin = require("firebase-admin");
const db = admin.firestore();
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const Joi = require("@hapi/joi");
const sgMail = require("@sendgrid/mail");

// Secret key for JWT (store this securely, e.g., in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Authentication
const registerUser = async (request, h) => {
  try {
    const {
      username,
      email,
      password,
      gender,
      status,
      phoneNumber,
      dateOfBirth,
    } = request.payload;

    // Check if the user already exists
    const userSnapshot = await db
      .collection("users")
      .where("email", "==", email)
      .get();
    if (!userSnapshot.empty) {
      return h.response({ error: "User already exists" }).code(409);
    }

    // Hash the password
    const hashedPassword = await argon2.hash(password);

    // Save the user to Firestore
    const newUser = await db.collection("users").add({
      username,
      email,
      password: hashedPassword, // Store hashed password
      gender,
      status,
      phoneNumber,
      dateOfBirth,
      userPoint: 0, // Initial user point
      courseStatus: "Inactive", // No active course
      onCourse: null, // No current course
      userStreak: 0, // No streak yet
      completedCourses: 0, // No completed courses
      totalCourses: 0, // Total courses to be added later
      deadline: null, // No deadline initially
      roadmaps: [], // Empty list of roadmaps
    });

    return h.response({ message: "User created successfully" }).code(201);
  } catch (error) {
    console.error("Error creating user:", error);
    return h.response({ error: "Unable to create user" }).code(500);
  }
};

const loginUser = async (request, h) => {
  try {
    const { email, password } = request.payload;

    // Find user by email
    const userSnapshot = await db
      .collection("users")
      .where("email", "==", email)
      .get();
    if (userSnapshot.empty) {
      return h.response({ error: "Invalid email or password" }).code(401);
    }

    // Extract user data
    const user = userSnapshot.docs[0].data();

    // Verify the password using Argon2
    const isValidPassword = await argon2.verify(user.password, password);
    if (!isValidPassword) {
      return h.response({ error: "Invalid email or password" }).code(401);
    }

    // Generate a JWT token
    const token = jwt.sign(
      { id: userSnapshot.docs[0].id, email: user.email },
      JWT_SECRET,
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    return h.response({ token, message: "Login successful" }).code(200);
  } catch (error) {
    console.error(error);
    return h.response({ error: "Unable to login" }).code(500);
  }
};

// Delete a user
const deleteUser = async (request, h) => {
  try {
    const { id } = request.params;
    await db.collection("users").doc(id).delete();
    return h.response({ message: "User deleted" }).code(200);
  } catch (error) {
    console.error(error);
    return h.response({ error: "Unable to delete user" }).code(500);
  }
};

// Get all users
const getAllUsers = async (request, h) => {
  try {
    const users = [];
    const snapshot = await db.collection("users").get();

    // Iterate through all users
    for (const doc of snapshot.docs) {
      const userData = { id: doc.id, ...doc.data() };

      // Fetch roadmaps subcollection for the user
      const roadmapsSnapshot = await db
        .collection("users")
        .doc(doc.id)
        .collection("roadmaps")
        .get();

      // Extract roadmaps into an array
      const roadmaps = [];
      roadmapsSnapshot.forEach((roadmapDoc) => {
        roadmaps.push({ id: roadmapDoc.id, ...roadmapDoc.data() });
      });

      // Include roadmaps in user data
      userData.roadmaps = roadmaps;

      // Add the user data to the users array
      users.push(userData);
    }

    return h.response(users).code(200);
  } catch (error) {
    console.error("Error fetching users:", error);
    return h.response({ error: "Unable to fetch users" }).code(500);
  }
};

// Users
const getUser = async (request, h) => {
  try {
    // Extract user ID from token payload
    const userId = request.user.id;

    // Fetch the user document from Firestore
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return h.response({ error: "User not found" }).code(404);
    }

    // Extract user data (exclude password)
    const userData = userDoc.data();
    const response = {
      username: userData.username,
      email: userData.email,
      status: userData.status,
      gender: userData.gender,
      phoneNumber: userData.phoneNumber,
      dateOfBirth: userData.dateOfBirth,
      userPoint: userData.userPoint,
    };

    // Fetch roadmaps subcollection
    const roadmapsSnapshot = await db
      .collection("users")
      .doc(userId)
      .collection("roadmaps")
      .get();

    // Extract roadmaps
    const roadmaps = [];
    roadmapsSnapshot.forEach((doc) => {
      roadmaps.push({ id: doc.id, ...doc.data() });
    });

    // Add roadmaps to response
    response.roadmaps = roadmaps;

    return h.response(response).code(200);
  } catch (error) {
    console.error("Error fetching user:", error);
    return h.response({ error: "Unable to fetch user details" }).code(500);
  }
};

const getUserStatus = async (request, h) => {
  try {
    // Extract user ID from the verified token
    const userId = request.user.id;

    // Fetch the user's document from Firestore
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return h.response({ error: "User not found" }).code(404);
    }

    // Extract user data
    const userData = userDoc.data();

    // Derive the number of courses left
    const totalCourses = userData.totalCourses || 0;
    const completedCourses = userData.completedCourses || 0;
    const coursesLeft = totalCourses - completedCourses;

    // Calculate days left until the deadline
    const deadlineTimestamp = userData.deadline || null; // Assume this is a Firestore timestamp
    const deadlineLeft = deadlineTimestamp
      ? Math.max(
          0,
          Math.ceil((deadlineTimestamp - Date.now()) / (1000 * 60 * 60 * 24))
        ) // Convert ms to days
      : null;

    // Construct the response object
    const response = {
      username: userData.username,
      userPoint: userData.userPoint || 0,
      courseStatus: userData.courseStatus || "Inactive",
      onCourse: userData.onCourse || "No active course",
      userStreak: userData.userStreak || 0,
      coursesLeft: coursesLeft,
      deadlineLeft: deadlineLeft,
    };

    return h.response(response).code(200);
  } catch (error) {
    console.error("Error fetching user status:", error);
    return h.response({ error: "Unable to fetch user status" }).code(500);
  }
};

// Roadmaps
const sendRoadmap = async (request, h) => {
  try {
    const { roadmapId, deadline } = request.payload;

    // Fetch the roadmap details from Firestore
    const roadmapDoc = await db.collection("roadmaps").doc(roadmapId).get();

    if (!roadmapDoc.exists) {
      return h.response({ error: "Roadmap not found" }).code(404);
    }

    const roadmapData = roadmapDoc.data();

    // Fetch the courses under the roadmap
    const coursesSnapshot = await db
      .collection("roadmaps")
      .doc(roadmapId)
      .collection("courses")
      .get();

    const listCourse = [];
    coursesSnapshot.forEach((doc) => {
      listCourse.push({ courseId: doc.id, title: doc.data().title });
    });

    // Calculate a sample score (e.g., percentage of completed courses)
    const completedCourses = roadmapData.completedCourses || 0;
    const totalCourses = listCourse.length;
    const skor =
      totalCourses > 0
        ? Math.floor((completedCourses / totalCourses) * 100)
        : 0;

    // Determine if the roadmap is finished
    const isFinish = completedCourses === totalCourses;

    // Construct the response
    const response = {
      roadmapName: roadmapData.title,
      listCourse: listCourse,
      deadline: deadline,
      skor: skor,
      isFinish: isFinish,
    };

    return h.response(response).code(200);
  } catch (error) {
    console.error("Error processing roadmap:", error);
    return h.response({ error: "Unable to process roadmap" }).code(500);
  }
};

// Course and Sub Course
const getCourse = async (request, h) => {
  try {
    const { roadmapId } = request.params;
    const courses = [];
    const snapshot = await db
      .collection("roadmaps")
      .doc(roadmapId)
      .collection("courses")
      .get();
    snapshot.forEach((doc) => {
      courses.push({ id: doc.id, ...doc.data() });
    });
    return h.response(courses).code(200);
  } catch (error) {
    console.error("Error fetching courses:", error);
    return h.response({ error: "Unable to fetch courses" }).code(500);
  }
};

const getSubCourse = async (request, h) => {
  try {
    const { roadmapId, courseId } = request.params;
    const subcourses = [];
    const snapshot = await db
      .collection("roadmaps")
      .doc(roadmapId)
      .collection("courses")
      .doc(courseId)
      .collection("subcourses")
      .get();
    snapshot.forEach((doc) => {
      subcourses.push({ id: doc.id, ...doc.data() });
    });
    return h.response(subcourses).code(200);
  } catch (error) {
    console.error("Error fetching subcourses:", error);
    return h.response({ error: "Unable to fetch subcourses" }).code(500);
  }
};

// OTP Handlers
const requestOTP = async (request, h) => {
  // Define the validation schema
  const schema = Joi.object({
    email: Joi.string().email().required(), // Ensure email is valid
  });

  // Validate the request payload
  const { error, value } = schema.validate(request.payload);
  if (error) {
    return h.response({ error: "Invalid email format" }).code(400);
  }

  const { email } = value; // Use validated email

  try {
    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP expiration time (e.g., 5 minutes)
    const expiresAt = Date.now() + 5 * 60 * 1000;

    // Save OTP in Firestore
    await db.collection("otps").doc(email).set({
      otp,
      expiresAt,
      verified: false,
    });

    // Prepare email
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM, // Your verified sender email
      subject: "Your OTP for Login",
      text: `Your OTP is: ${otp}. It is valid for 5 minutes.`,
      html: `<p>Your OTP is: <strong>${otp}</strong></p><p>It is valid for 5 minutes.</p>`,
    };

    // Send email using SendGrid
    await sgMail.send(msg);

    return h.response({ message: "OTP sent successfully" }).code(200);
  } catch (error) {
    console.error("Error sending OTP:", error);
    return h.response({ error: "Unable to send OTP" }).code(500);
  }
};

const verifyOTP = async (request, h) => {
  try {
    const { email, otp } = request.payload;

    // Retrieve OTP data from Firestore
    const otpDoc = await db.collection("otps").doc(email).get();

    if (!otpDoc.exists) {
      return h.response({ error: "OTP not found" }).code(404);
    }

    const otpData = otpDoc.data();

    // Check if the OTP is expired
    if (Date.now() > otpData.expiresAt) {
      return h.response({ error: "OTP expired" }).code(400);
    }

    // Check if the OTP is correct
    if (otp !== otpData.otp) {
      return h.response({ error: "Invalid OTP" }).code(401);
    }

    // Mark the OTP as verified
    await db.collection("otps").doc(email).update({ verified: true });

    // Generate a JWT token
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });

    return h.response({ token, message: "Login successful" }).code(200);
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return h.response({ error: "Unable to verify OTP" }).code(500);
  }
};

// Quesioner
const sendQuesioner = async (request, h) => {
  const schema = Joi.object({
    roadmapName: Joi.string().min(1).required(),
  });

  const { error, value } = schema.validate(request.payload);
  if (error) {
    return h.response({ error: error.details[0].message }).code(400);
  }

  const { roadmapName } = value;

  try {
    const userId = request.user.id;
    const userRef = db.collection("users").doc(userId);

    // Step 1: Check if the roadmap already exists
    const roadmapsSnapshot = await userRef
      .collection("roadmaps")
      .where("roadmapName", "==", roadmapName)
      .get();

    if (!roadmapsSnapshot.empty) {
      return h.response({ error: "Roadmap already exists" }).code(400);
    }

    // Step 2: Add the new roadmap
    await userRef.collection("roadmaps").add({
      roadmapName,
      addedAt: new Date().toISOString(),
    });

    return h.response({ message: "Roadmap added successfully" }).code(201);
  } catch (error) {
    console.error("Error adding roadmap:", error);
    return h.response({ error: "Unable to add roadmap" }).code(500);
  }
};

// Delete Roadmap
const deleteRoadmap = async (request, h) => {
  try {
    const userId = request.user.id; // Authenticated user's ID
    const { roadmapName } = request.params; // Roadmap ID from the path

    // Reference the user's roadmaps subcollection
    const roadmapRef = db
      .collection("users")
      .doc(userId)
      .collection("roadmaps")
      .doc(roadmapName);

    // Check if the roadmap exists
    const roadmapDoc = await roadmapRef.get();
    if (!roadmapDoc.exists) {
      return h.response({ error: "Roadmap not found" }).code(404);
    }

    // Delete the roadmap
    await roadmapRef.delete();

    return h.response({ message: "Roadmap deleted successfully" }).code(200);
  } catch (error) {
    console.error("Error deleting roadmap:", error);
    return h.response({ error: "Unable to delete roadmap" }).code(500);
  }
};

module.exports = {
  deleteUser,
  registerUser,
  getAllUsers,
  loginUser,
  getUser,
  getUserStatus,
  sendRoadmap,
  getCourse,
  getSubCourse,
  requestOTP,
  verifyOTP,
  sendQuesioner,
  deleteRoadmap,
};
