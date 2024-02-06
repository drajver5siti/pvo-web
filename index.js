import express from 'express';
import path from 'path';
import multer from 'multer';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

dotenv.config();


/**
 * @typedef Result
 * 
 * @prop {num} statusCode
 * @prop {number} time
 * @prop {string} data
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = 3000;

// app.use(express.json());
app.use(express.urlencoded({ extended: false }));


const storage = multer.memoryStorage();
const upload = multer({ storage });

const resource = (_) => path.join(__dirname, `/resources/${_}`);

/**
 * @returns {Promise<Result>} 
 */
const sendRequest = async (data) => {
    const HOST = process.env.API_HOST;
    const PORT = process.env.API_PORT;

    return fetch(`http://${HOST}:${PORT}/upload`, {
        method: 'post',
        body: data
    }).then(async (x) => {
        return await x.text();
    })
}

app.get('/', (req, res) => res.sendFile(resource('/index.html')));

app.post(
    '/start', 
    upload.single('file'),
    async (req, res) => {
        const { numOfRequests = 1 } = req.body;
        const file = req.file;

        if (file === undefined) {
            res.status(400);
            return res.json({ message: "Must provide a file" });
        }

        const data = new FormData();
        data.append(
            "file", 
            new Blob([file.buffer], { type: file.mimetype }), 
            file.originalname
        );

        const requests = Array
            .from({ length: numOfRequests })
            .map(() => sendRequest(data));


        const startTime = process.hrtime();

        try {
            const result = await Promise.all(requests);
            const millis = (process.hrtime(startTime)[0] * 1000) + process.hrtime(startTime)[1] / 1000000;
    
            return res.json({
                numOfRequests: parseInt(numOfRequests),
                time: parseFloat(millis.toFixed(5)),
                result: result[0]
            })
        } catch (err) {
            res.status(503);
            console.log(err)
            return res.json({
                message: "API is down"
            })
        }
    }
)

app.listen(port, () => {
    console.log("listening on port " + port);
})