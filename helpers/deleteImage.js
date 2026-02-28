const fs = require('fs');
// const advrtModel = require('./models/admin');

const deleteUploadImage = async (fileName) => {
    try {
        const directoryPath = './public/uploads';
        const filePath = `${directoryPath}/${fileName}`;
        // Check if the file exists before attempting to delete
        fs.unlink(filePath,(err)=>{
            if(err) console.log(err)
            console.log(fileName, ' has been deleted')
        })
      
    } catch (error) {
        console.error(`Error deleting ${fileName}: ${error.message}`);
    }
};

module.exports = deleteUploadImage;
