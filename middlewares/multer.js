const multer=require('multer')
const path=require('path')

const uploadDir = path.join(__dirname, '../public/uploads/temp');

const storage=multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null, uploadDir)
    },
    filename:(req,file,cb)=>{
        cb(null, `${Date.now()}-${file.originalname}`)
    }
})

const upload=multer({
    storage: storage,
    limits: {fileSize: 20*1024*1024},
    fileFilter:(req,file,cb)=>{
        const fileTypes = /jpeg|jpg|png|gif|webp/;
        const extName = fileTypes.test(path.extname(file.originalname).toLowerCase())
        const mimeType = fileTypes.test(file.mimetype)

        if(extName && mimeType){            
            cb(null,true)
        }else{
            cb(new Error('Only images are allowed'))
        }
    }
})

module.exports=upload