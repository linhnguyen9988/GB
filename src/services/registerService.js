import DBConnection from "./../configs/DBConnection";
import bcrypt from "bcryptjs";

let createNewUser = (data) => {
    return new Promise(async (resolve, reject) => {
        // check user is exist or not
        let isUserExist = await checkExistUser(data.username);
        if (isUserExist) {
            reject(`Tên "${data.username}" đã tồn tại. Hãy chọn tên khác`);
        } else {
            // hash password
            let salt = bcrypt.genSaltSync(10);
            let userItem = {
                fullname: data.fullname,
                username: data.username,
                password: bcrypt.hashSync(data.password, salt),
            };

            //create a new account
            DBConnection.query(
                ' INSERT INTO users set ? ', userItem,
                function(err, rows) {
                    if (err) {
                        reject(false)
                    }
                    resolve("Tạo tài khoản thành công");
                }
            );
        }
    });
};
let checkExistUser = (username) => {
    return new Promise( (resolve, reject) => {
        try {
            DBConnection.query(
                ' SELECT * FROM `users` WHERE `username` = ?  ', username,
                function(err, rows) {
                    if (err) {
                        reject(err)
                    }
                    if (rows.length > 0) {
                        resolve(true)
                    } else {
                        resolve(false)
                    }
                }
            );
        } catch (err) {
            reject(err);
        }
    });
};
module.exports = {
    createNewUser: createNewUser
};
