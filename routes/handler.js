// routes/handler.js
const admin = require("firebase-admin");
const db = admin.firestore();
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
// Secret key for JWT (store this securely, e.g., in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

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
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });
    return h.response(users).code(200);
  } catch (error) {
    console.error(error);
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

    // Extract user data
    const userData = userDoc.data();
    const response = {
      username: userData.username,
      email: userData.email,
      status: userData.status,
      roadmap: userData.roadmap,
      gender: userData.gender,
      phoneNumber: userData.phoneNumber,
      dateOfBirth: userData.dateOfBirth,
      userPoint: userData.userPoint,
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
    const { title, description } = request.payload;

    // Add roadmap to Firestore
    const newRoadmap = await db.collection("roadmaps").add({
      title,
      description,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return h
      .response({ id: newRoadmap.id, message: "Roadmap created successfully" })
      .code(201);
  } catch (error) {
    console.error("Error creating roadmap:", error);
    return h.response({ error: "Unable to create roadmap" }).code(500);
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
    const snapshot = await db.collection('roadmaps').doc(roadmapId).collection('courses').doc(courseId).collection('subcourses').get();
    snapshot.forEach((doc) => {
        subcourses.push({ id: doc.id, ...doc.data() });
    });
    return h.response(subcourses).code(200);
} catch (error) {
    console.error('Error fetching subcourses:', error);
    return h.response({ error: 'Unable to fetch subcourses' }).code(500);
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
};
