# manifest.json Notes

## "permissions"
* These are the browser permissions that the extension needs to be installed.

## "optional_permissions"
* Permissions that the extension does not need at install time but may request later.

## "browser_action"
* The icon that your browser adds in the toolbar.
* "popup.html" contains the HTML for the page.

## "page_action"
* The icon that your browswer adds in the URL bar.
* "pageActionPopup.html" runs "pageAction.js" that will display the name/icon of the container that you are in when accesessing this webpage in the URL bar and also formats the tab with the correct coloring.
* "show_matches" is used to show this HTML whenever you perform a search.

## "background"
* "page"
    * Links to another page in the extension that contains mulitple <script> tags that will execute .js files in the background once the extension starts runnning (aka when the browswer is started).

## "content scripts"
* "matches"
    * "<all_urls>" is used to run the content_script.js file whenever you open a link while this extension is running.
* "js"
    * "content_script.js" runs everytime a specified url matches the url accessed.
* "css"
    * Just for formatting? What is it formatting?
* "run_at"
    * Whenever the webpages loads, run the JS script.

## "web_accessible_resources"
* HTMl, CSS, JS, images that you want to make available to other webpages.

## "options_ui"
* Specify path to HTML file packaged with your extension. This functions as a settings page where you can get to it by clicking the "Multi-Account Containers" icon in the toolbar and then clicking the "i" icon.