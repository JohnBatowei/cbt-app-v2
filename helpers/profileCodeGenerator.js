const profileCodeModel = require("../models/profileCode");
// const studentModel = require("../models/student");

async function generateUniqueProfileCode(prefix) {
  const year = new Date().getFullYear();
  const base = `${prefix}${year}`;

  // Find the latest profileCode starting with the base prefix + year
  const lastStudent = await profileCodeModel.findOne({ profileCode: { $regex: `^${base}` } })
    .sort({ profileCode: -1 }) // Get the highest one
    .lean();

  let nextNumber = 1;

  if (lastStudent && lastStudent.profileCode) {
    const lastCode = lastStudent.profileCode;
    const numericPart = lastCode.slice(base.length); // Extract the last 4 digits
    nextNumber = parseInt(numericPart, 10) + 1;
  }

  // Pad the number with leading zeros up to 4 digits
  const paddedNumber = String(nextNumber).padStart(4, '0');
  const newProfileCode = `${base}${paddedNumber}`;

  return newProfileCode;
}

module.exports = generateUniqueProfileCode;
