import express from 'express';
import path from 'path';
import multer from 'multer';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { fetch } from 'undici';

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
const port = process.env.PORT;

// app.use(express.json());
app.use(express.urlencoded({ extended: false }));


const storage = multer.memoryStorage();
const upload = multer({ storage });

const resource = (_) => path.join(__dirname, `/resources/${_}`);

/**
 * @returns {Promise<Result>} 
 */
const sendRequest = async (data, toCloudRun) => {

    /**
     * if toCloudRun is false send to FIRST_API_HOST else send to SECOND_API_HOST
     */

    const HOST = toCloudRun ? process.env.SECOND_API_HOST : process.env.FIRST_API_HOST;
    const PORT = toCloudRun ? process.env.SECOND_API_PORT : process.env.FIRST_API_PORT;

    return fetch(`${HOST}:${PORT}/upload`, {
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
        let { numOfRequests = 1, toCloudRun = false } = req.body;
        const file = req.file;

        toCloudRun = Boolean(toCloudRun);

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
            .map(() => sendRequest(data, toCloudRun));


        const startTime = process.hrtime();

        try {
            const result = await Promise.allSettled(requests);
            const millis = (process.hrtime(startTime)[0] * 1000) + process.hrtime(startTime)[1] / 1000000;
    
            return res.json({
                numOfRequests: parseInt(numOfRequests),
                failedRequests: result.filter(x => x.status === 'rejected').length,
                time: parseFloat(millis.toFixed(5)),
                result: result.find(x => x.status === "fulfilled"),
                error: result.find(x => x.status === "rejected")
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