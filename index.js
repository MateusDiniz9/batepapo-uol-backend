import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import joi from "joi";
import dayjs from "dayjs";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
  db = mongoClient.db("bate_papo_uol");
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message").required(),
});

const participantsSchema = joi.object({
  name: joi.string().required(),
});

app.post("/participants", async (req, res) => {
  const user = req.body;
  const validation = participantsSchema.validate(user, { abortEarly: false });
  if (validation.error) {
    console.log(validation.error.details);
    res.sendStatus(422);
    return;
  }
  try {
    const part = await db
      .collection("participants")
      .findOne({ name: user.name });
    if (part) {
      res.sendStatus(409);
      return;
    }
    try {
      await db
        .collection("participants")
        .insertOne({ ...user, lastStatus: Date.now() });
      await db.collection("messages").insertOne({
        from: user.name,
        to: "Todos",
        text: "entra na sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      });
      res.sendStatus(201);
    } catch (error) {
      console.error(err);
      res.status(500).send("Problema do servidor ao inserir um participante");
    }
  } catch (error) {
    console.error(err);
    res
      .status(500)
      .send(
        "Problema do servidor ao verificar se ja existe esse participante no sistema"
      );
  }
});

app.get("/participants", async (req, res) => {
  try {
    const users = await db.collection("participants").find().toArray();
    res.send(users);
  } catch (error) {
    console.error(err);
    res.status(500).send("Problema do servidor ao listar todos participantes");
  }
});

app.post("/messages", async (req, res) => {
  const message = req.body;
  const user = req.headers.user;
  const validation = messageSchema.validate(message, { abortEarly: false });
  if (validation.error) {
    console.log(validation.error.details);
    res.sendStatus(422);
    return;
  }
  try {
    if (!(await db.collection("participants").findOne({ name: user }))) {
      res.sendStatus(409);
      return;
    }
    try {
      await db.collection("messages").insertOne({
        ...message,
        from: user,
        time: dayjs().format("HH:mm:ss"),
      });
      res.sendStatus(201);
    } catch (error) {
      console.error(err);
      res.status(500).send("Problema do servidor ao inserir mensagem");
    }
  } catch (error) {
    console.error(err);
    res
      .status(500)
      .send(
        "Problema do servidor ao verificar se ja existe esse participante no sistema"
      );
  }
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.headers.user;
  try {
    const messages = await db
      .collection("messages")
      .find({ $or: [{ to: "Todos" }, { from: user }, { to: user }] })
      .toArray();
    if (limit) {
      const limitMessages = messages.slice(-limit);
      res.send(limitMessages);
      return;
    }
    res.send(messages);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .send("Problema do servidor ao listar as mensagens do usuario");
  }
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;
  try {
    if (!db.collection("participants").findOne({ name: user })) {
      res.sendStatus(404);
      return;
    }
    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (error) {
    console.error(err);
    res
      .status(500)
      .send("Problema do servidor ao mudar o status de um usuario");
  }
});

setInterval(async () => {
  try {
    const participants = await db.collection("participants").find().toArray();
    const inactivesPart = participants.filter(
      (participant) => Date.now() - participant.lastStatus > 10000
    );
    inactivesPart.forEach(async (part) => {
      await db.collection("participants").deleteOne(part);
      await db.collection("messages").insertOne({
        from: part.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs().format("HH:mm:ss"),
      });
    });
  } catch (error) {
    console.error(err);
    res
      .status(500)
      .send("Problema do servidor ao atualizar o status de todos usuarios");
  }
}, 15000);

app.listen(5000, () => {
  console.log("Server is litening on port 5000.");
});
