import express from "express";
import { mongoClient, ObjectId } from "mongodb";
import cors from "cors";
import Joi from "joi";
import dotenv from "dotenv";
import dayjs from "dayjs";
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => {
  db = mongoClient.db("bate_papo_uol");
});

const app = express();
app.use(cors());
app.use(express.json());

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string("message" || "private_message").required(),
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
    if (!(await db.collection("participants").findOne({ user }))) {
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
        time: dayjs().format("HH/mm/ss"),
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
        time: dayjs().format("HH/mm/ss"),
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
    const messages = await bd
      .collection("messages")
      .find({ to: "Todos" } || { from: user } || { to: user })
      .toArray();
    if (limit) {
      const limitMessages = messages.slice(-limit);
      res.send(limitMessages);
    }
    res.send(messages);
  } catch (error) {
    console.error(err);
    res
      .status(500)
      .send("Problema do servidor ao listar as mensagens do usuario");
  }
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;
  try {
    if (!db.collection("participants").find({ name: user })) {
      res.sendStatus(404);
      return;
    }
    //falta atualizar o last status do participante
    res.sendStatus(200);
  } catch (error) {
    console.error(err);
    res
      .status(500)
      .send("Problema do servidor ao mudar o status de um usuario");
  }
});

//falta remover automaticamente usuarios inativos

app.listen(5000, () => {
  console.log("Server is litening on port 5000.");
});
