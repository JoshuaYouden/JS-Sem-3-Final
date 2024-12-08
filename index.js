const express = require("express");
const expressWs = require("express-ws");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");
const User = require("./models/user");
const Poll = require("./models/poll");
const { exit } = require("process");

const PORT = 3000;
//TODO: Update this URI to match your own MongoDB setup
const MONGO_URI = "mongodb://localhost:27017/JS_Final";
const app = express();
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(
  session({
    secret: "voting-app-secret",
    resave: false,
    saveUninitialized: false,
  })
);
let connectedClients = [];

//Note: Not all routes you need are present here, some are missing and you'll need to add them yourself.

app.ws("/ws", (socket, request) => {
  connectedClients.push(socket);

  socket.on("message", async (message) => {
    const data = JSON.parse(message);
    if (data.type === "vote") {
      await onNewVote(data.pollId, data.selectedOption);
    }
  });

  socket.on("close", async (message) => {
    connectedClients = connectedClients.filter((client) => client !== socket);
  });
});

app.get("/", async (request, response) => {
  if (request.session.user?.id) {
    return response.redirect("/dashboard");
  }

  response.render("index/unauthenticatedIndex", {});
});

app.get("/login", async (request, response) => {
  response.render("login", { errorMessage: null });
});

app.post("/login", async (request, response) => {
  const { username, email, password } = request.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return response.render("login", { errorMessage: "Invalid credentials" });
    }
    request.session.user = { id: user._id, username: user.username };
    return response.redirect("/dashboard");
  } catch (error) {
    console.error("Error logging in:", error);
    return response.render("login", {
      errorMessage: "An error has occurred, please try again",
    });
  }
});

app.get("/signup", async (request, response) => {
  const { username, email, password } = request.query;
  if (request.session.user?.id) {
    return response.redirect("/dashboard");
  }

  return response.render("signup", {
    errorMessage: null,
    username: username ?? "",
    email: email ?? "",
    password: password ?? "",
  });
});

app.post("/signup", async (request, response) => {
  const { username, email, password } = request.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();
    response.redirect("/login");
  } catch (error) {
    console.error(error);
    response.render("signup", { errorMessage: "Error signing up" });
  }
});

app.get("/logout", async (request, response) => {
  request.session.destroy();
  response.redirect("/");
});

// app.post("/logout", async (request, response) => {
//   await User.findByIdAndDelete(request.session.user.id).then(() => {
//     response.redirect("/");
//   });
// });

app.get("/dashboard", async (request, response) => {
  if (!request.session.user?.id) {
    return response.redirect("/");
  }
  const polls = await Poll.find({});

  //TODO: Fix the polls, this should contain all polls that are active. I'd recommend taking a look at the
  //authenticatedIndex template to see how it expects polls to be represented
  return response.render("index/authenticatedIndex", { polls });
});

app.get("/profile", async (request, response) => {
  if (!request.session.user?.id) {
    return response.redirect("/");
  }

  const polls = await Poll.find({});

  return response.render("profile", {
    name: request.session.user.username,
    polls,
  });
});

app.get("/createPoll", async (request, response) => {
  if (!request.session.user?.id) {
    return response.redirect("/");
  }

  return response.render("createPoll");
});

// Poll creation
app.post("/createPoll", async (request, response) => {
  const { question, options } = request.body;

  if (!question || !options || Object.values(options).length < 2) {
    return response.render("createPoll", {
      errorMessage: "A poll must have a question and at least two options.",
    });
  }

  const formattedOptions = Object.values(options).map((option) => ({
    answer: option,
    votes: 0,
  }));

  try {
    const poll = new Poll({
      question,
      options: formattedOptions,
      createdBy: request.session.user.id,
      createdAt: new Date(),
    });
    await poll.save();

    response.redirect("/dashboard");
  } catch (error) {
    console.error("Error creating poll:", error);
    response.render("createPoll", {
      errorMessage: "An unexpected error occurred. Please try again.",
    });
  }
});

mongoose
  .connect(MONGO_URI)
  .then(() =>
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    )
  )
  .catch((err) => console.error("MongoDB connection error:", err));

/**
 * Handles creating a new poll, based on the data provided to the server
 *
 * @param {string} question The question the poll is asking
 * @param {[answer: string, votes: number]} pollOptions The various answers the poll allows and how many votes each answer should start with
 * @returns {string?} An error message if an error occurs, or null if no error occurs.
 */
async function onCreateNewPoll(question, pollOptions, userId) {
  try {
    //TODO: Save the new poll to MongoDB
    const poll = new Poll({
      question,
      options: pollOptions,
      createdBy: userId,
    });
    await poll.save();

    //TODO: Tell all connected sockets that a new poll was added
    for (const client of connectedClients) {
      if (client.readyState === 1) {
        client.send(JSON.stringify({ type: "newPoll", poll }));
      }
    }
  } catch (error) {
    console.error(error);
    return "Error creating the poll, please try again";
  }

  return null;
}

/**
 * Handles processing a new vote on a poll
 *
 * This function isn't necessary and should be removed if it's not used, but it's left as a hint to try and help give
 * an idea of how you might want to handle incoming votes
 *
 * @param {string} pollId The ID of the poll that was voted on
 * @param {string} selectedOption Which option the user voted for
 */
async function onNewVote(pollId, selectedOption) {
  try {
    const poll = await Poll.findById(pollId);
    if (!poll) {
      console.error("Poll not found");
      return;
    }

    const option = poll.options.find((opt) => opt.answer === selectedOption);
    if (option) {
      option.votes += 1;
      await poll.save();
      for (const client of connectedClients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ type: "poll-update", poll }));
        }
      }
    }
  } catch (error) {
    console.error("Error updating poll:", error);
  }
}
