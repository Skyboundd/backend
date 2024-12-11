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
      { expiresIn: "168h" } // Token expires in 1 week
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
      roadmaps: userData.roadmaps.map((roadmap) => roadmap.roadmapId).join(","),
    };

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
    const userPercentage = ((totalCourses - coursesLeft) / totalCourses) * 100;

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
      userPercentage: userPercentage,
    };

    return h.response(response).code(200);
  } catch (error) {
    console.error("Error fetching user status:", error);
    return h.response({ error: "Unable to fetch user status" }).code(500);
  }
};

// Roadmaps
const assignAndSendRoadmap = async (request, h) => {
  try {
    const { roadmapId, deadline } = request.payload;
    const userId = request.user.id;

    // Fetch the roadmap details from Firestore
    const roadmapDoc = await db.collection("roadmaps").doc(roadmapId).get();

    if (!roadmapDoc.exists) {
      return h.response({ error: "Roadmap not found" }).code(404);
    }

    const roadmapData = roadmapDoc.data();

    // Extract courses and subcourses
    const courses = roadmapData.learningTopics.map((topic) => ({
      courseName: topic.name,
      subcourses: topic.subTopics.map((sub) => ({
        subcourseName: sub.name,
        difficultyLevel: sub.difficultyLevel,
        learningOrder: sub.learningOrder,
      })),
    }));

    // Construct the roadmap data to store in the user document
    const roadmapEntry = {
      roadmapId,
      jobRole: roadmapData.jobRole,
      courses: courses, // Each course contains its subcourses
      deadline: deadline || null,
    };

    // Reference the user document
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      const userData = userDoc.data();

      // Check if the roadmap is already assigned
      if (
        userData.roadmaps &&
        userData.roadmaps.some((roadmap) => roadmap.roadmapId === roadmapId)
      ) {
        return h
          .response({ error: "Roadmap is already assigned to the user" })
          .code(400);
      }

      // Add the roadmap to the existing roadmaps array
      await userRef.update({
        roadmaps: [...userData.roadmaps, roadmapEntry],
      });
    } else {
      // Create a new user document with the roadmap
      await userRef.set({
        roadmaps: [roadmapEntry],
      });
    }

    // Prepare the response with the nested structure
    const response = {
      roadmaps: [
        {
          roadmapId,
          courses: courses.map((course) => ({
            courseName: course.courseName,
            subcourses: course.subcourses.map((sub) => ({
              subcourseName: sub.subcourseName,
            })),
          })),
        },
      ],
      message: "Roadmap, courses, and subcourses assigned successfully.",
    };

    return h.response(response).code(200);
  } catch (error) {
    console.error("Error processing roadmap:", error);
    return h.response({ error: "Unable to process roadmap" }).code(500);
  }
};

// User's Course and Sub Course
const getUserCourses = async (request, h) => {
  try {
    const userId = request.user.id; // Extract userId from token

    // Fetch the user document from Firestore
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return h.response({ error: "User not found" }).code(404);
    }

    const userData = userDoc.data();

    if (!userData.roadmaps || userData.roadmaps.length === 0) {
      return h
        .response({ error: "No roadmaps assigned to the user" })
        .code(404);
    }

    // Extract courses from all assigned roadmaps
    const courses = userData.roadmaps.flatMap((roadmap) =>
      roadmap.courses.map((course) => ({
        courseName: course.courseName,
      }))
    );

    return h.response({ courses }).code(200);
  } catch (error) {
    console.error("Error fetching user courses:", error);
    return h.response({ error: "Unable to fetch user courses" }).code(500);
  }
};

const getUserSubCourse = async (request, h) => {
  try {
    const userId = request.user.id; // Extract userId from token
    const { roadmapId } = request.params;

    // Fetch the user document from Firestore
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return h.response({ error: "User not found" }).code(404);
    }

    const userData = userDoc.data();

    if (!userData.roadmaps || userData.roadmaps.length === 0) {
      return h
        .response({ error: "No roadmaps assigned to the user" })
        .code(404);
    }

    // Find the specific roadmap
    const roadmap = userData.roadmaps.find((r) => r.roadmapId === roadmapId);

    if (!roadmap) {
      return h.response({ error: "Roadmap not found for the user" }).code(404);
    }

    // Extract subcourses from the roadmap's courses
    const subcourses = roadmap.courses.flatMap((course) =>
      course.subcourses.map((subcourse) => ({
        subcourseName: subcourse.subcourseName,
      }))
    );

    return h.response({ subcourses }).code(200);
  } catch (error) {
    console.error("Error fetching user subcourses:", error);
    return h.response({ error: "Unable to fetch user subcourses" }).code(500);
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

    // Set OTP expiration time (e.g., 10 minutes)
    const expiresAt = Date.now() + 10 * 60 * 1000;

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
      text: `Your OTP is: ${otp}. It is valid for 10 minutes.`,
      html: `<p>Your OTP is: <strong>${otp}</strong></p><p>It is valid for 10 minutes.</p>`,
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
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "168h" });

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

    // Step 1: Check if the roadmap already exists for the user
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return h.response({ error: "User not found." }).code(404);
    }

    const userData = userDoc.data();
    const existingRoadmaps = userData.roadmaps || [];
    if (existingRoadmaps.some((r) => r.roadmapName === roadmapName)) {
      return h.response({ error: "Roadmap already exists." }).code(400);
    }

    // Step 2: Fetch the roadmap details from the global roadmaps collection
    const roadmapSnapshot = await db
      .collection("roadmaps")
      .where("jobRole", "==", roadmapName)
      .get();

    if (roadmapSnapshot.empty) {
      return h.response({ error: "Roadmap not found." }).code(404);
    }

    const roadmapDoc = roadmapSnapshot.docs[0]; // Assuming roadmap names are unique
    const roadmapData = roadmapDoc.data();

    // Step 3: Extract courses and subcourses (including descriptions)
    const courses = roadmapData.learningTopics.map((topic) => ({
      courseName: topic.name,
      subcourses: topic.subTopics.map((sub) => ({
        subcourseName: sub.name,
        description: sub.description, // Include description
        difficultyLevel: sub.difficultyLevel || null,
        learningOrder: sub.learningOrder || null,
      })),
    }));

    // Step 4: Add the roadmap (including courses and subcourses) to the user's roadmaps field
    const newRoadmap = {
      roadmapName,
      addedAt: new Date().toISOString(),
      courses, // Nested structure with courses and subcourses
    };

    await userRef.update({
      roadmaps: [...existingRoadmaps, newRoadmap], // Append the new roadmap
    });

    return h.response({ message: "Roadmap added successfully." }).code(201);
  } catch (error) {
    console.error("Error adding roadmap:", error);
    return h.response({ error: "Unable to add roadmap." }).code(500);
  }
};

// Delete Roadmap
const deleteUserRoadmap = async (request, h) => {
  try {
    const { roadmapId } = request.payload; // Roadmap ID from the request payload
    const userId = request.user.id; // User ID from the token

    // Validate inputs
    if (
      !roadmapId ||
      typeof roadmapId !== "string" ||
      roadmapId.trim() === ""
    ) {
      return h.response({ error: "Invalid roadmapId provided." }).code(400);
    }

    // Reference the user document in Firestore
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    // Check if the user exists
    if (!userDoc.exists) {
      return h.response({ error: "User not found." }).code(404);
    }

    const userData = userDoc.data();
    const { roadmaps } = userData;

    // Check if the user has the roadmap assigned
    if (!roadmaps || roadmaps.length === 0) {
      return h.response({ error: "No roadmaps assigned to the user." }).code(404);
    }

    // Find the roadmap in the array
    const roadmapExists = roadmaps.some((roadmap) => roadmap.roadmapId === roadmapId);

    if (!roadmapExists) {
      return h.response({ error: "Roadmap not found in user data." }).code(404);
    }

    // Remove the roadmap from the roadmaps array
    const updatedRoadmaps = roadmaps.filter((roadmap) => roadmap.roadmapId !== roadmapId);
    await userRef.update({ roadmaps: updatedRoadmaps });

    return h.response({ message: "Roadmap deleted successfully." }).code(200);
  } catch (error) {
    console.error("Error deleting roadmap:", error);
    return h.response({ error: "Unable to delete roadmap." }).code(500);
  }
};

// Get roadmap spesific subcourses
const getAUserSubcourses = async (request, h) => {
  try {
    const userId = request.user.id; // Extract user ID from token
    const { roadmapName, courseName } = request.params;

    // Validate input values
    if (!roadmapName || !courseName) {
      return h.response({ error: "Missing or invalid roadmapName or courseName" }).code(400);
    }

    // Fetch user document
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return h.response({ error: "User not found" }).code(404);
    }

    const userData = userDoc.data();
    const userRoadmap = userData.roadmaps.find((r) => r.roadmapId === roadmapName);

    if (!userRoadmap) {
      return h.response({ error: "Roadmap not assigned to the user" }).code(404);
    }

    // Fetch roadmap from Firestore
    const roadmapSnapshot = await db
      .collection("roadmaps")
      .where("jobRole", "==", roadmapName)
      .get();

    if (roadmapSnapshot.empty) {
      return h.response({ error: "Roadmap not found in Firestore" }).code(404);
    }

    const roadmap = roadmapSnapshot.docs[0].data();

    // Find the course in the roadmap
    const course = roadmap.learningTopics.find((topic) => topic.name === courseName);

    if (!course) {
      return h.response({ error: "Course not found in the roadmap" }).code(404);
    }

    // Extract subcourses with required fields
    const subcourses = course.subTopics.map((sub) => ({
      subcourseName: sub.name,
      description: sub.description,
    }));

    return h.response({ message: "Subcourses retrieved successfully.", subcourses }).code(200);
  } catch (error) {
    console.error("Error retrieving user subcourses:", error);
    return h.response({ error: "Unable to fetch subcourses." }).code(500);
  }
};

module.exports = {
  deleteUser,
  registerUser,
  getAllUsers,
  loginUser,
  getUser,
  getUserStatus,
  assignAndSendRoadmap,
  getUserCourses,
  getUserSubCourse,
  requestOTP,
  verifyOTP,
  sendQuesioner,
  deleteUserRoadmap,
  getAUserSubcourses,
};
