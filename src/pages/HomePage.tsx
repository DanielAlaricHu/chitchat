import React, { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

const chatScenes = [
  [
    {
      sender: "John",
      avatar: "J",
      avatarColor: "bg-purple-200 text-purple-700",
      bubbleColor: "bg-gray-100 text-gray-800",
      text: "Hey! Have you heard Emily said somebody ate her cake? It was me!",
      align: "left",
    },
    {
      sender: "Me",
      avatar: "M",
      avatarColor: "bg-orange-200 text-orange-700",
      bubbleColor: "bg-blue-100 text-blue-900",
      text: "I knew it!",
      align: "right",
    },
  ],
  [
    {
      sender: "Emily",
      avatar: "E",
      avatarColor: "bg-pink-200 text-pink-700",
      bubbleColor: "bg-gray-100 text-gray-800",
      text: "Anyone up for coffee later?",
      align: "left",
    },
    {
      sender: "Me",
      avatar: "M",
      avatarColor: "bg-orange-200 text-orange-700",
      bubbleColor: "bg-blue-100 text-blue-900",
      text: "Count me in! I want 5 cups of long black, with a dash of milk, and a sprinkle of cinnamon.",
      align: "right",
    },
    {
      sender: "Emily",
      avatar: "E",
      avatarColor: "bg-pink-200 text-pink-700",
      bubbleColor: "bg-gray-100 text-gray-800",
      text: "How about you order by yourself?",
      align: "left",
    },
  ],
  [
    {
      sender: "Alex",
      avatar: "A",
      avatarColor: "bg-green-200 text-green-700",
      bubbleColor: "bg-gray-100 text-gray-800",
      text: "Did you finish the project?",
      align: "left",
    },
    {
      sender: "Me",
      avatar: "M",
      avatarColor: "bg-orange-200 text-orange-700",
      bubbleColor: "bg-blue-100 text-blue-900",
      text: "Project??? WHAT PROJECT????",
      align: "right",
    },
    {
      sender: "Alex",
      avatar: "A",
      avatarColor: "bg-green-200 text-green-700",
      bubbleColor: "bg-gray-100 text-gray-800",
      text: "Hahahaha! You're so screwed!",
      align: "left",
    },
  ],
];

const HomePage: React.FC = () => {
  const { signInWithGoogle } = useAuth();

  // Pick a random scene only once per mount
  const scene = useMemo(
    () => chatScenes[Math.floor(Math.random() * chatScenes.length)],
    []
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row justify-center items-center p-8 bg-white relative">
      {/* Left: Main content */}
      <div className="w-full max-w-lg z-10">
        <h1 className="font-poiretone text-4xl font-bold mb-4 text-left">
          Hey!<br />How about some <br />
          <span className="text-6xl font-pacifico my-6 block orange-purple-gradient-text">Chit-Chat?</span>
        </h1>
        <p className="text-lg text-gray-700 mb-8 text-left">
          A real-time chat app built with React, Firebase, FastAPI, and Tailwind CSS.
        </p>
        <div className="w-full max-w-xs">
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-300 rounded shadow hover:bg-gray-50 transition"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="w-6 h-6"
            />
            <span className="font-medium">Continue with Google</span>
          </button>
        </div>
      </div>

      {/* Right: Decorative chat mockups (hidden on small screens) */}
      <div className="hidden md:flex flex-col gap-8 ml-16">
        {/* Top right chat mockup */}
        <div className="flex flex-col gap-4">
          {scene.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${
                msg.align === "right" ? "justify-end ml-12" : ""
              }`}
            >
              {msg.align === "left" && (
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${msg.avatarColor}`}
                >
                  {msg.avatar}
                </div>
              )}
              <div
                className={`rounded-lg px-4 py-2 shadow max-w-xs font-normal ${msg.bubbleColor}`}
              >
                <span className="font-semibold">{msg.sender}:</span> {msg.text}
              </div>
              {msg.align === "right" && (
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${msg.avatarColor}`}
                >
                  {msg.avatar}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomePage;