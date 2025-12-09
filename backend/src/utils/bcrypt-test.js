import bcrypt from "bcryptjs";

/**
 * Script để test và generate bcrypt password
 * Chạy: node src/utils/bcrypt-test.js
 */

const testBcryptPassword = async () => {
    console.log("=== BCRYPT PASSWORD TESTING ===\n");
    
    const plainPassword = "123456";
    
    const javaHash = "$2a$07$x.jg.b5diX8gduspUlLEhOgt05EzryiU4Fxvm29Bwf6iiK2kIViu2";
    
    console.log("Plain password:", plainPassword);
    console.log("Java BCrypt hash:", javaHash);
    console.log();
    
    const isMatch = await bcrypt.compare(plainPassword, javaHash);
    console.log("Password matches Java hash:", isMatch);
    
    const wrongPassword = "wrong123";
    const wrongMatch = await bcrypt.compare(wrongPassword, javaHash);
    console.log("Wrong password matches:", wrongMatch);
    
    console.log("\n=== GENERATE NEW HASHES ===\n");
    
    const nodeHash7 = await bcrypt.hash(plainPassword, 7);
    console.log("Node.js BCrypt (rounds=7):", nodeHash7);
    const match7 = await bcrypt.compare(plainPassword, nodeHash7);
    console.log("Verify:", match7);
    console.log();
    
    const nodeHash10 = await bcrypt.hash(plainPassword, 10);
    console.log("Node.js BCrypt (rounds=10):", nodeHash10);
    const match10 = await bcrypt.compare(plainPassword, nodeHash10);
    console.log("Verify:", match10);
    console.log();
    
    const nodeHash12 = await bcrypt.hash(plainPassword, 12);
    console.log("Node.js BCrypt (rounds=12):", nodeHash12);
    const match12 = await bcrypt.compare(plainPassword, nodeHash12);
    console.log("Verify:", match12);
    console.log();
    
    console.log("=== SQL UPDATE COMMANDS ===\n");
    console.log(`-- Update với hash rounds=7 (tương thích Java)`);
    console.log(`UPDATE User SET password = '${nodeHash7}' WHERE username = 'admin';`);
    console.log();
    console.log(`-- Update với hash rounds=10 (recommended)`);
    console.log(`UPDATE User SET password = '${nodeHash10}' WHERE username = 'admin';`);
};

// Hàm tiện ích để hash password
export const hashPassword = async (password, rounds = 7) => {
    return await bcrypt.hash(password, rounds);
};

// Hàm tiện ích để verify password
export const verifyPassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

// Chạy test nếu file được execute trực tiếp
if (import.meta.url === `file://${process.argv[1]}`) {
    testBcryptPassword().catch(console.error);
}

export default {
    hashPassword,
    verifyPassword,
    testBcryptPassword
};