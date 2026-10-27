// Same starting prices and costs as supabase/schema.sql.
export const CONFIG_PUBLICA = {
  "negocio": {
    "nombre": "Ecoglobal",
    "telefono": "",
    "pie": "¡Gracias por tu compra!",
    "indicativo": "57"
  },
  "tolerancia": 5,
  "cierreDia": 6,
  "ultimoContador": 196709,
  "ultimoContadorColor": 0,
  "ultimoContadorBN": 0,
  "conceptos": [
    "Acrílico",
    "Servicio de corte",
    "Servicio de armado",
    "Acarreo",
    "Instalación",
    "Diseño"
  ],
  "plastificado": {
    "precio": 1000
  },
  "tamanos": [
    {
      "id": "carta",
      "nombre": "Carta/Oficio (23 x 33 cm)",
      "clics": 1,
      "piezas": 9
    },
    {
      "id": "t48",
      "nombre": "33 x 48 cm",
      "clics": 2,
      "piezas": 4
    },
    {
      "id": "t70",
      "nombre": "33 x 70 cm",
      "clics": 3,
      "piezas": 3
    },
    {
      "id": "t100",
      "nombre": "33 x 100 cm",
      "clics": 4,
      "piezas": 3
    },
    {
      "id": "t46",
      "nombre": "32 x 46 cm",
      "clics": 2,
      "piezas": 4
    }
  ],
  "gramajes": [
    {
      "id": "g75",
      "nombre": "Bond 75 g"
    },
    {
      "id": "g150",
      "nombre": "Propalcote 150 g"
    },
    {
      "id": "g200",
      "nombre": "Propalcote 200 g"
    },
    {
      "id": "g240",
      "nombre": "Propalcote 240 g"
    },
    {
      "id": "g300",
      "nombre": "Propalcote 300 g"
    }
  ],
  "sustratos": [
    {
      "id": "cc",
      "nombre": "Corriente Carta/Oficio",
      "tamano": "carta",
      "corriente": true,
      "precios": [
        2100,
        1900,
        1700,
        1600
      ]
    },
    {
      "id": "c48",
      "nombre": "Corriente 33 x 48 cm",
      "tamano": "t48",
      "corriente": true,
      "precios": [
        4000,
        3600,
        3300,
        3000
      ]
    },
    {
      "id": "c70",
      "nombre": "Corriente 33 x 70 cm",
      "tamano": "t70",
      "corriente": true,
      "precios": [
        5600,
        5300,
        5000,
        4700
      ]
    },
    {
      "id": "c100",
      "nombre": "Corriente 33 x 100 cm",
      "tamano": "t100",
      "corriente": true,
      "precios": [
        8000,
        7500,
        7000,
        6500
      ]
    },
    {
      "id": "opc",
      "nombre": "Opalina Carta/Oficio",
      "tamano": "carta",
      "corriente": false,
      "precios": [
        2400,
        2200,
        2000,
        1800
      ]
    },
    {
      "id": "adc",
      "nombre": "Adhesivo Carta/Oficio",
      "tamano": "carta",
      "corriente": false,
      "precios": [
        2600,
        2400,
        2200,
        2000
      ]
    },
    {
      "id": "ad48",
      "nombre": "Adhesivo 33 x 48 cm",
      "tamano": "t48",
      "corriente": false,
      "precios": [
        4500,
        4300,
        4100,
        3900
      ]
    },
    {
      "id": "vin",
      "nombre": "Vinilo blanco o transparente 32 x 46 cm",
      "tamano": "t46",
      "corriente": false,
      "precios": [
        6800,
        6500,
        6200,
        5900
      ]
    },
    {
      "id": "met",
      "nombre": "Metalizado 33 x 48 cm",
      "tamano": "t48",
      "corriente": false,
      "precios": [
        6000,
        5800,
        5600,
        5400
      ]
    }
  ]
};

export const CONFIG_COSTOS = {
  "costoClic": 655,
  "costoClicColor": 0,
  "costoClicBN": 0,
  "plastificadoCosto": 0,
  "gramajes": {
    "g75": 369,
    "g150": 728,
    "g200": 972,
    "g240": 1165,
    "g300": 1495
  },
  "sustratos": {
    "opc": 3500,
    "adc": 2300,
    "ad48": 2300,
    "vin": 0,
    "met": 0
  }
};
