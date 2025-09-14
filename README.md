# LaroChat

An Omegle-like anonymous chat application that uses the BroadcastChannel API to enable real-time communication between browser tabs.

## Features

- 🚀 **Real-time messaging** between browser tabs using BroadcastChannel API
- 🎨 **Modern, responsive UI** with gradient design and smooth animations
- 👤 **Customizable usernames** with persistent storage
- 📱 **Mobile-friendly** responsive design
- 🔔 **Connection notifications** when users join/leave
- 💬 **Message history** with timestamps
- 🧹 **Clear chat** functionality
- ⚡ **Instant communication** without server dependencies

## How to Use

1. **Open the application** by opening `index.html` in your web browser
2. **Open a second tab** with the same URL (Ctrl+T or Cmd+T)
3. **Start chatting!** Messages sent from one tab will appear in the other tab instantly
4. **Customize your name** by clicking "Change Name" in the footer
5. **Clear the chat** anytime using the "Clear Chat" button

## Technical Details

- **BroadcastChannel API**: Enables communication between tabs/windows of the same origin
- **No server required**: All communication happens client-side
- **Local storage**: Username preferences are saved locally
- **Modern CSS**: Uses CSS Grid, Flexbox, and modern styling techniques
- **ES6+ JavaScript**: Clean, modular code with class-based architecture

## Browser Support

LaroChat requires a modern browser that supports:
- BroadcastChannel API (Chrome 54+, Firefox 38+, Safari 15.4+)
- ES6+ JavaScript features
- CSS Grid and Flexbox

## File Structure

```
├── index.html          # Main HTML structure
├── styles.css          # CSS styling and responsive design
├── script.js           # JavaScript functionality and BroadcastChannel logic
└── README.md           # This file
```

## Development

To run locally:
1. Clone or download the repository
2. Open `index.html` in a web browser
3. Open the same file in another tab to test communication

## License

This project is open source and available under the MIT License.