# chor-js-demo

__[:rocket: Live Version :rocket:](https://bpt-lab.org/chor-js-demo/)__

A simple demo application showing the usage of the _npm package_ of [`chor-js`](https://github.com/bptlab/chor-js) to view and edit BPMN 2.0 choreography diagrams in the browser.

The demo also adds some features such as diagram upload and download, and a [validator](./app/lib/validator).

> For an example on how to use the pre-packaged version of chor-js, please refer to the [README there](https://github.com/bptlab/chor-js).

## Local Usage

### Node

You can install and run the demo locally using Node.js.

#### Run Only

```shell
npm install
npm run dev
```

You can also build it using `npm run build`.

The demo is then served to `http://localhost:9013`.
We use [Parcel](https://parceljs.org) as a build tool.
Thus, unless you set up the project as a development environment (see below), chor-js will not be transpiled and polyfilled, which should be no problem for modern browsers.

#### Development Environment

If you want to use the demo while developing [chor-js](https://github.com/bptlab/chor-js), you can link the two repositories:

```shell
git clone https://github.com/bptlab/chor-js.git
cd chor-js
npm install
npm link

cd ..
git clone https://github.com/bptlab/chor-js-demo.git
cd chor-js-demo
npm install
npm link chor-js
npm run dev
```

### Docker

We also provide a `Dockerfile` to use with Docker.

```shell
docker build . -t chor-js-demo
docker run --rm -p 9013:9013 --name chor-js-demo -it chor-js-demo
```

The demo is then served to `http://localhost:9013` as a production build using the latest version of chor-js (see Dockerfile).

## License

MIT

## How to start the software (Back-end)
From the root (echors) digit: node .\bpmn-to-solidity\server.js  For start the back-end

## How to start the Front-End 
From the root (echors) digit: npm run dev

## Autore
Questo software è stato sviluppato da [Alessio Prosperi]
Contatti: [alessio2066@gmail.com] | [https://github.com/SaltyEner] 

## Note sulle dipendenze

Questo progetto utilizza e modifica la libreria open source [chor-js](https://github.com/bptlab/chor-js), originariamente sviluppata da Jan Ladleif e altri contributori, sotto licenza MIT.  
Si riconosce e si ringrazia il lavoro originale degli autori di chor-js.