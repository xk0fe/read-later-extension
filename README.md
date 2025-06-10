<div align="center">
  <img src="icons/icon128.png" alt="Read Later Extension" width="128" height="128">
  
  # Read Later Extension 📚
  
  A simple browser extension for Chrome based browsers that helps you manage your reading queue with priorities and time estimates.
</div>

<div align="center">
  <img src="preview/screenshot_0.png" alt="Read Later Extension Interface" width="400">
  <p>😎</p>
</div>

## Features ✨

- **Quick Save**: Right-click on any page or link to save it to your reading list
- **Priority System**: Assign High, Medium, or Low priority to your saved links
- **Time Estimates**: Set how long you think each item will take to read/watch
- **Smart Filtering**: Filter by priority and search through your saved links
- **Sorting Options**: Sort by date added, priority, read time, or title
- **Tag Support**: Add tags to organize your links
- **Data Management**: Export/import your data and manage storage
- **Clean Interface**: Modern, responsive design that works great on all screen sizes

## Installation 🚀

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome/Opera and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The Read Later extension should now appear in your browser toolbar

### From Chrome Web Store (NOT Coming Soon)

I have no plans on posting this on any extension store whatsoever.

## Usage 📖

### Saving Links

**Method 1: Right-click Context Menu**
- Right-click on any page or link
- Select "Save to Read Later"
- Fill in the details (title, priority, time estimate, tags)
- Click "Save Link"

**Method 2: Extension Popup**
- Click the Read Later icon in your browser toolbar
- Click "Add Current Page"
- Fill in the details and save

### Managing Your Links

- **View All Links**: Click the extension icon to see your reading list
- **Filter by Priority**: Use the priority dropdown to filter links
- **Search**: Type in the search box to find specific links
- **Sort**: Choose how to sort your links (date, priority, time, title)
- **Open Links**: Click on any link title to open it in a new tab
- **Delete Links**: Click the trash icon to remove unwanted links

### Settings & Data Management

- Right-click the extension icon and select "Options"
- Set default priority and time estimates
- Export your data as a JSON backup
- Import previously exported data
- Clear all data if needed

## Technical Details 🔧

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: 
  - `storage` - For saving your links locally
  - `activeTab` - For accessing current page information
  - `contextMenus` - For right-click menu integration
- **Storage**: Uses Chrome's local storage API for data persistence
- **Compatibility**: Works with Chrome, Opera, and other Chromium-based browsers

## Data Format 📊

Your saved links are stored with the following structure:

```json
{
  "id": "unique-identifier",
  "url": "https://example.com",
  "title": "Page Title",
  "priority": "high|medium|low",
  "timeToRead": 15,
  "dateAdded": "2024-01-01T00:00:00.000Z",
  "tags": ["tag1", "tag2"]
}
```

## Privacy 🔒

- **Local Storage Only**: All your data is stored locally on your device
- **No External Servers**: No data is sent to external servers
- **No Tracking**: The extension doesn't track your browsing habits
- **No Ads**: Completely ad-free experience

## Contributing 🤝

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

1. Clone the repository
2. Make your changes
3. Test the extension in developer mode
4. Submit a pull request

## License 📄

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support 💬

If you encounter any issues or have feature requests:

1. Check the existing issues on GitHub
2. Create a new issue with a detailed description
3. Include your browser version and operating system

## Changelog 📝

### v1.0.0
- Initial release
- Basic save/delete functionality
- Priority and time estimation
- Search and filtering
- Data export/import
- Modern UI design

## Attributions

[Publication icons created by meaicon - Flaticon](https://www.flaticon.com/free-icons/publication)

---

**Enjoy organizing your reading queue!** 🎉 
