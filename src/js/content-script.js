/**
 * Description: This page runs everytime any url is accessed. There is no core
 * logic here, it is just animating the page using the logo whenever there is 
 * a message sent.
 */

/**
 * Wait for x amount of delay.
 */
async function delayAnimation(delay = 350) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

/**
 * Do the animation on some element.
 */
async function doAnimation(element, property, value) {
  return new Promise((resolve) => {
    const handler = () => {
      resolve();
      element.removeEventListener("transitionend", handler);
    };
    element.addEventListener("transitionend", handler);
    window.requestAnimationFrame(() => {
      element.style[property] = value;
    });
  });
}

/**
 * Perform the animation whenever a message is sent. At the end of this function,
 * there have been no state changes.
 */
async function addMessage(message) {
  const divElement = document.createElement("div");
  divElement.classList.add("container-notification");
  // Ideally we would use https://bugzilla.mozilla.org/show_bug.cgi?id=1340930 when this is available
  divElement.innerText = message.text;

  const imageElement = document.createElement("img");
  const imagePath = browser.extension.getURL("/img/container-site-d-24.png");
  const response = await fetch(imagePath);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  imageElement.src = objectUrl;
  divElement.prepend(imageElement);

  document.body.appendChild(divElement);

  await delayAnimation(100);
  await doAnimation(divElement, "transform", "translateY(0)");
  await delayAnimation(3000);
  await doAnimation(divElement, "transform", "translateY(-100%)");

  divElement.remove();
}

// browser.runtime.onMessage is used to listen for messages from other parts of the extension
// Example: A content script can listen for messages from a background script using browswer.runtime.onMessage
// Runs anytime a message is sent to the browser runtime.
browser.runtime.onMessage.addListener((message) => {
  addMessage(message);
});
