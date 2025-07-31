const express = require("express");
const puppeteer = require("puppeteer");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const getData = async () => {
  const browser = await puppeteer.launch({
    headless: true,
    ignoreDefaultArgs: ["--disable-extensions"],
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  return await loadUrl(
    page,
    "https://diariooficial.elperuano.pe/Normas?_ga=2.68318803.31570302.1652488170-1881688147.1651255230",
    browser
  );
};

async function loadUrl(page, url, browser) {
  await page.goto(url, {
    waitUntil: ["load"],
  });
  await page.waitForTimeout(1000);
  const valorEncontrado = await page.$eval(
    "#NormasEPPortal",
    (el) => el.innerHTML
  );

  const total_data = await page.waitForSelector(
    ".edicionesoficiales_articulos"
  );

  const data = await page.evaluate(() => {
    const elements = document.querySelectorAll(".edicionesoficiales_articulos");
    const books = [];

    for (let element of elements) {
      const obj = {};
      obj.title = element.querySelector(".ediciones_texto h4").innerHTML;
      obj.ley = element.querySelector(".ediciones_texto h5 a").href;
      obj.ley_title = element.querySelector(".ediciones_texto h5 a").innerHTML;
      obj.date = element.querySelector(
        ".ediciones_texto p:nth-of-type(1)"
      ).innerText;
      obj.description = element.querySelector(
        ".ediciones_texto p:nth-of-type(2)"
      ).innerHTML;
      obj.image = element.querySelector(".ediciones_pdf img").src;
      /*obj.download = element.querySelector(
        ".ediciones_botones ul li a:first-child"
      ).href;*/
      obj.download = element.querySelector(
        ".ediciones_botones ul li input[data-url]"
      ).getAttribute('data-url');
      books.push(obj);
    }

    return books;
  });

  await browser.close();

  return data;
}

/*OPINIONES OSCE*/

const OSCE_URL = (page) =>
  //`https://www.gob.pe/institucion/osce/colecciones/713-opiniones-de-la-direccion-tecnico-normativa`;
  `https://www.gob.pe/institucion/oece/colecciones/66839-opiniones-de-la-direccion-tecnico-normativa-oece`;

const OSCE_RESOLUTIONS_URL = (page) =>
  //`https://www.gob.pe/institucion/osce/colecciones/716-resoluciones-del-tribunal-de-contrataciones-del-estado`;
  `https://www.gob.pe/institucion/oece/colecciones/68030`;

const self = {
  browser: null,
  page: null,

  initalize: async (page) => {
    self.browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    self.page = await self.browser.newPage();

    /*Go to sub opinion */

    await self.page.goto(OSCE_URL(page), { waitUntil: "networkidle0" });
  },

  getResults: async (number) => {
    let results = [];

    do {
      let new_results = await self.parseResults();
      results = [...results, ...new_results];
      if (results.length < number) {
        await self.page.waitForSelector(
          'nav[class*="font-bold"] > ul > li > span[class*="next"] > a',
          {
            visible: true,
          }
        );

        let nextPageButton = await self.page.$(
          'nav[class*="font-bold"] > ul > li > span[class*="next"] > a'
        );

        if (nextPageButton) {
          await nextPageButton.click();
          await self.page.waitForTimeout(500);
        } else {
          break;
        }
      }
    } while (results.length < number);

    return results;
  },

  getResolutions: async (number) => {
    await self.page.goto(OSCE_RESOLUTIONS_URL(self.page), {
      waitUntil: "networkidle0",
    });

    let results = [];

    do {
      let new_results = await self.parseResults();
      results = [...results, ...new_results];
      if (results.length < number) {
        await self.page.waitForSelector(
          'nav[class*="font-bold"] > ul > li > span[class*="next"] > a',
          {
            visible: true,
          }
        );

        let nextPageButton = await self.page.$(
          'nav[class*="font-bold"] > ul > li > span[class*="next"] > a'
        );

        if (nextPageButton) {
          await nextPageButton.click();
          await self.page.waitForTimeout(500);
        } else {
          break;
        }
      }
    } while (results.length < number);

    return results;
  },
  parseResults: async () => {
    let elements = await self.page.$$(
      '.js-official-documents-search-results > div[class*="row"] > div[class*="col-md-6"]'
    );

    let results = [];

    for (let element of elements) {
      let title = await element.$eval(
        'a[class*="leading-6"]',
        (elem) => elem.innerText
      );

      let date = await element.$eval(
        'div[class*="pb-2"]',
        (elem) => elem.innerText
      );

      let available = await element.$eval(
        'div[class*="leading-5"]',
        (elem) => elem.innerText
      );

      let link = await element.$eval(
        'a[class*="leading-6"]',
        (elem) => elem.href
      );

      let parseLink = link.replace("https://www.gob.pe", "");

      await self.page.waitForSelector(`a[href="${parseLink}"]`, {
        visible: true,
      });
      await self.page.click(`a[href="${parseLink}"]`);

      await self.page.waitForSelector(
        'div[class*="description"]:nth-of-type(1)',
        {
          visible: true,
        }
      );
      let description = await self.page.$eval(
        "#main > div > div > div > div > article > section > div > div > div > div:nth-child(1)",
        (elem) => elem.innerText
      );

      await self.page.waitForSelector('a[class*="btn--secondary"]', {
        visible: true,
      });

      let download = await self.page.$eval(
        'a[class*="btn--secondary"]',
        (elem) => elem.href
      );

      results.push({
        date,
        title,
        link,
        available,
        description,
        download,
      });

      await self.page.goBack();
    }
    return results;
  },
};

const getOpinions = async (initialPage, opinionsCount) => {
  await self.initalize(initialPage);

  let results = await self.getResults(opinionsCount);
  return results;
};

const getResolutions = async (initialPage, opinionsCount) => {
  await self.initalize(initialPage);

  let results = await self.getResolutions(opinionsCount);
  return results;
};

app.get("/", async (req, res) => {
  const data = await getData();
  res.json({
    data,
  });
});

app.get("/opinions", async (req, res) => {
  const { max } = req.query;
  const data = await getOpinions(1, max || 20);

  res.json({
    length: data.length,
    data,
  });
});

app.get("/resolutions", async (req, res) => {
  const { max } = req.query;
  const data = await getResolutions(1, max || 20);

  res.json({
    length: data.length,
    data,
  });
});

const port = process.env.PORT || 8080;

app.listen(port, () => {
  console.log("Servidor creado en el puerto", port);
});
