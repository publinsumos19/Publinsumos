import { MdAccountBalanceWallet, MdBarChart, MdDashboard, MdInventory, MdLock, MdPeople, MdPointOfSale, MdPrint, MdReceiptLong, MdRequestQuote, MdSettings, MdLockClock, MdMoneyOff, MdContacts } from 'react-icons/md';
import Vender from './views/Vender';
import Ventas from './views/Ventas';
import Cartera from './views/Cartera';
import Inventario from './views/Inventario';
import Cuadre from './views/Cuadre';
import Reportes from './views/Reportes';
import Ajustes from './views/Ajustes';
import Usuarios from './views/Usuarios';
import Dashboard from './views/Dashboard';
import Cotizador from './views/Cotizador';
import CarteraPrivada from './views/CarteraPrivada';
import Cierre from './views/Cierre';
import Gastos from './views/Gastos';
import Clientes from './views/Clientes';

const routes = [
  { name: 'Dashboard', path: '/dashboard', icon: MdDashboard, element: <Dashboard /> },
  { name: 'Vender', path: '/vender', icon: MdPointOfSale, element: <Vender /> },
  { name: 'Cotizador', path: '/cotizador', icon: MdRequestQuote, element: <Cotizador /> },
  { name: 'Clientes', path: '/clientes', icon: MdContacts, element: <Clientes /> },
  { name: 'Ventas', path: '/ventas', icon: MdReceiptLong, element: <Ventas /> },
  { name: 'Cartera', path: '/cartera', icon: MdAccountBalanceWallet, element: <Cartera /> },
  { name: 'Cartera privada', path: '/cartera-privada', icon: MdLock, element: <CarteraPrivada />, admin: true },
  { name: 'Inventario', path: '/inventario', icon: MdInventory, element: <Inventario /> },
  { name: 'Cuadre', path: '/cuadre', icon: MdPrint, element: <Cuadre />, admin: true },
  { name: 'Gastos', path: '/gastos', icon: MdMoneyOff, element: <Gastos /> },
  { name: 'Cierre de caja', path: '/cierre', icon: MdLockClock, element: <Cierre /> },
  { name: 'Reportes', path: '/reportes', icon: MdBarChart, element: <Reportes />, admin: true },
  { name: 'Ajustes', path: '/ajustes', icon: MdSettings, element: <Ajustes />, admin: true },
  { name: 'Usuarios', path: '/usuarios', icon: MdPeople, element: <Usuarios />, admin: true },
];

export default routes;
