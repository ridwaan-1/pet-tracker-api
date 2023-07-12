const express = require("express");
const cors = require('cors');
const path = require('path');
const nodemailer = require("nodemailer");
const mysql = require('mysql2');
const WebSocket = require('ws')

const sockserver = new WebSocket.WebSocketServer({ port: 443 })
sockserver.on('connection', ws => {
    ws.send('connection established')
    ws.on('close', () => console.log('Client has disconnected!'))
    ws.on('message', data => {
        sockserver.clients.forEach(client => {
            console.log(JSON.parse(data))
            client.send(`${data}`)
        })
    })
    ws.onerror = function () {
        console.log('websocket error')
    }
})

require('dotenv').config()

const connection = mysql.createConnection(process.env.DATABASE_URL);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('src/templates'))

app.get('/pet_location', async function (req, res) {
    try {
        connection.query('SELECT * FROM coordinates ORDER BY created_time DESC LIMIT 1;', (err, rows) => {
            if (rows.length > 0) {
                res.status(200).json({
                    valid: true,
                    ...rows[0]
                });

                return;
            }
            res.status(200).json({
                valid: true,
            });
        });
    } catch (err) {
        res.status(404).json({
            valid: false,
            message: err.message
        });
    }
})

app.post('/pet_location', async function (req, res) {
    try {
        const data = req.body;
        console.log(data);
        const latitude = data.latitude
        const longitude = data.longitude

        connection.query(
            'INSERT INTO coordinates(latitude, longitude) VALUES(?, ?);',
            [latitude, longitude],
            function (err, results) {
                if (err) {
                    return res.status(404).json({
                        valid: false,
                        message: JSON.stringify(err)
                    });
                }

                return res.status(200).json({
                    valid: true,
                    message: 'Coordinates saved successfully'
                });
            }
        );
    } catch (err) {
        res.status(404).json({
            valid: false,
            message: err.message
        });
    }
})

app.get('/pet_detection', async function (req, res) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.SENDER_EMAIL,
                pass: process.env.SENDER_EMAIL_PASS
            }
        });

        const url = req.protocol + "://" + req.headers.host

        await transporter.sendMail({
            from: process.env.SENDER_EMAIL,
            to: process.env.RECEIVER_EMAIL,
            subject: "Pet Not Detected !!!",
            html: `
            <html>
                <body>
                    <h3>Hi, Ridwaan</h3>
                    <h3>Your pet is lost</h3>
                    <h2><a href="${url}/pet_location_map">Click this link to track your pet</a></h2>
                </body>
            </html>
            `
        });

        return res.status(200).json({
            valid: true,
            message: 'User Alerted successfully'
        });
    } catch (err) {
        res.status(404).json({
            valid: false,
            message: err.message
        });
    }
})

app.get('/pet_location_map', function (req, res) {
    try {
        res.sendFile(path.join(__dirname, '/src/templates/map.html'));
    } catch (err) {
        res.sendFile(path.join(__dirname, '/src/templates/error.html'));
    }
})

app.listen(process.env.PORT || 8080);