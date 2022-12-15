// const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));

// onmessage = (e) => {
//   const { num } = e.data;
//   const startTime = new Date().getTime();
//   const fibNum = fib(num);
//   postMessage({
//     fibNum,
//     time: new Date().getTime() - startTime,
//   });
// };

// Path: apps/web/src/pages/index.tsx
// const worker = new window.Worker("src/fib-worker.js");

// btn.addEventListener("click", (e) => {
//   errPar.textContent = "";
//   const num = window.Number(input.value);
//   if (num < 2) {
//     errPar.textContent = "Please enter a number greater than 2";
//     return;
//   }

//   worker.postMessage({ num });
//   worker.onerror = (err) => err;
//   worker.onmessage = (e) => {
//     const { time, fibNum } = e.data;
//     const resultDiv = document.createElement("div");
//     resultDiv.innerHTML = textCont(num, fibNum, time);
//     resultDiv.className = "result-div";
//     resultsContainer.appendChild(resultDiv);
//   };
// });
