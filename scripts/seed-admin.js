import argon2 from "argon2";
import postgres from "postgres";
import { config } from "../dist/config.js";

async function main() {
  const sql = postgres(config.dbConfig.dbURL);

  try {
    // 1. Get an active university department
    const [dept] = await sql`
      SELECT university_department_id 
      FROM university_department 
      WHERE is_active = true 
      LIMIT 1
    `;

    if (!dept) {
      console.error("No active university department found in database.");
      process.exit(1);
    }

    const email = "admin@chirpy.com";
    const username = "admin";
    const plainPassword = "Admin123!";
    const hashedPassword = await argon2.hash(plainPassword);

    // 2. Insert or update the admin user
    const [existing] = await sql`
      SELECT user_id FROM users 
      WHERE email_address = ${email} OR username = ${username}
      LIMIT 1
    `;

    if (existing) {
      await sql`
        UPDATE users 
        SET 
          username = ${username},
          email_address = ${email},
          hashed_password = ${hashedPassword},
          email_verified_at = NOW(),
          is_verified = true,
          role = 'admin'
        WHERE user_id = ${existing.user_id}
      `;
      console.log("Admin account updated successfully!");
    } else {
      await sql`
        INSERT INTO users (
          university_department_id,
          username,
          email_address,
          hashed_password,
          email_verified_at,
          is_verified,
          role
        ) VALUES (
          ${dept.university_department_id},
          ${username},
          ${email},
          ${hashedPassword},
          NOW(),
          true,
          'admin'
        )
      `;
      console.log("Admin account created successfully!");
    }

    console.log("-----------------------------------------");
    console.log("Admin Email:    " + email);
    console.log("Admin Username: " + username);
    console.log("Admin Password: " + plainPassword);
    console.log("Admin Role:     admin");
    console.log("Email Verified: true");
    console.log("-----------------------------------------");
  } catch (error) {
    console.error("Error creating admin account:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
