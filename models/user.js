const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

const { getDBReference } = require('../lib/mongo');
const { extractValidFields } = require('../lib/validation');

/*
 * User Schema
 */
const UserSchema = {
  name: { required: true },
  email: { required: true },
  password: { required: true },
  role: { required: true }
};
exports.UserSchema = UserSchema;

/*
 * Insert new user into DB
 */
exports.insertNewUser = async (user) => {
  const newUser = extractValidFields(user, UserSchema);

  //hash users password
  newUser.password = await bcrypt.hash(
    newUser.password,
    8
  );

  const db = getDBReference();
  const collection = db.collection('Users');

  //try to insert into Users collection
  const result = await collection.insertOne(newUser);

  //return users id from insertion
  return result.insertedId;
};

/*
 * Fetch user info from DB using id
 * if includePassword is true, include user password else omit
 *
 */
exports.getUserInfoById = async (id) => {
  const db = getDBReference();
  const user_collection = db.collection('Users');
  const courses_collection = db.collection('Courses');

  if (ObjectId.isValid(id)) {
    //get user info from Users collection
    const results = await user_collection.find({ _id: new ObjectId(id) })
        .project({ password: 0 })
        .toArray();

    let user = results[0];

    // get courses the user belongs to
    //  TODO: change roles to enum values
    if (user.role === 'instructor') {
      //get courses with this userId
      const courses = await courses_collection.find({ instructorId: new ObjectId(id) })
        .toArray();

      user['courses'] = courses;

    } else if (user.role === 'student') {
      const courses = await courses_collection.find({ studentId: new ObjectId(id) })
        .toArray();

      user['courses'] = courses;
    }

    return user
  } else {
    return null;
  }
};

exports.getUserByEmail = async (email, includePassword) => {
  const db = getDBReference();
  const collection = db.collection('Users');


  const projection = includePassword ? {} : { password: 0 };
  const results = await collection.find({ email: email })
      .project(projection)
      .toArray();

  if (results[0])
    return results[0];
  else
    return null;

};

//checks password with hash of password stored in DB
// if they match, return user id and role
exports.validateUser = async (email, password) => {
  const user = await exports.getUserByEmail(email, true);

  if (user && await bcrypt.compare(password, user.password)) {
    return { id: user._id, role: user.role };
  } else {
    return null;
  }
}
