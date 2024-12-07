const { on } = require("../models/user");

// Establish a WebSocket connection to the server
const socket = new WebSocket("ws://localhost:3000/ws");

socket.onopen = () => {
  console.log("Connection established.");
};

// Listen for messages from the server
socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);

  //TODO: Handle the events from the socket
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === "poll-update") {
      onIncomingVote(data);
    } else if (data.type === "new-poll") {
      onNewPollAdded(data);
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket Error:", error);
  };

  socket.onclose = () => {
    console.warn("WebSocket connection closed.");
  };
});

/**
 * Handles adding a new poll to the page when one is received from the server
 *
 * @param {*} data The data from the server (ideally containing the new poll's ID and it's corresponding questions)
 */
function onNewPollAdded(data) {
  //TODO: Fix this to add the new poll to the page

  const pollContainer = document.getElementById("polls");
  const newPoll = document.createElement("li");
  newPoll.classList.add("poll-container");
  newPoll.id = data.id;
  newPoll.innerHTML = `
    <h2>${poll.question}</h2>
    <ul class="poll-options">
      ${poll.options
        .map(
          ({ answer, votes }) =>
            `<li id="${poll._id}_${answer}">
              <strong>${answer}:</strong> ${votes} votes
            </li>`
        )
        .join("")}
    </ul>
    <form class="poll-form button-container">
      ${poll.options
        .map(
          ({ answer }) =>
            `<button class="action-button vote-button" type="submit" value="${answer}" name="poll-option">
              Vote for ${answer}
            </button>`
        )
        .join("")}
      <input type="hidden" value="${poll._id}" name="poll-id" />
    </form>
  `;

  pollContainer.appendChild(newPoll);

  //TODO: Add event listeners to each vote button. This code might not work, it depends how you structure your polls on the poll page. However, it's left as an example
  //      as to what you might want to do to get clicking the vote options to actually communicate with the server
  newPoll.querySelectorAll(".poll-form").forEach((pollForm) => {
    pollForm.addEventListener("submit", onVoteClicked);
  });
}

/**
 * Handles updating the number of votes an option has when a new vote is recieved from the server
 *
 * @param {*} data The data from the server (probably containing which poll was updated and the new vote values for that poll)
 */
function onIncomingVote(data) {
  const poll = data.poll;
  const pollContainer = document.getElementById(poll.id);

  if (pollContainer) {
    const options = pollContainer.querySelector(".poll-options");
    options.innerHTML = "";
    poll.options.forEach(({ answer, votes }) => {
      options.innerHTML += `<li>><strong>${answer}:</strong> ${votes} votes</li>`;
    });
  }
}

/**
 * Handles processing a user's vote when they click on an option to vote
 *
 * @param {FormDataEvent} event The form event sent after the user clicks a poll option to "submit" the form
 */
function onVoteClicked(event) {
  //Note: This function only works if your structure for displaying polls on the page hasn't changed from the template. If you change the template, you'll likely need to change this too
  event.preventDefault();
  const formData = new FormData(event.target);

  const pollId = formData.get("poll-id");
  const selectedOption = event.submitter.value;

  //TOOD: Tell the server the user voted
}

//Adds a listener to each existing poll to handle things when the user attempts to vote
document.querySelectorAll(".poll-form").forEach((pollForm) => {
  pollForm.addEventListener("submit", onVoteClicked);
});
