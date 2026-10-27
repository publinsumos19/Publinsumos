import {
  Box, Button, Flex, Modal, ModalBody, ModalCloseButton, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text,
  useColorModeValue, useToast,
} from '@chakra-ui/react';
import { FaWhatsapp } from 'react-icons/fa';
import { MdContentCopy } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { waLink } from '../lib/receipt';

export default function ShareModal({ isOpen, onClose, title, text, tel, extra }) {
  const { cfg } = useAuth();
  const toast = useToast();
  const bg = useColorModeValue('secondaryGray.300', 'navy.900');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Texto copiado', status: 'success', duration: 2000 });
    } catch {
      toast({ title: 'No se pudo copiar. Selecciona el texto y cópialo.', status: 'warning' });
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent borderRadius="20px" mx="12px">
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box as="pre" bg={bg} p="16px" borderRadius="12px" fontFamily="mono" fontSize="13px" whiteSpace="pre-wrap" wordBreak="break-word">
            {text}
          </Box>
          {!tel && (
            <Text mt="10px" fontSize="sm" color="secondaryGray.600">
              No hay número de WhatsApp. WhatsApp te dejará elegir el contacto.
            </Text>
          )}
        </ModalBody>
        <ModalFooter gap="10px" flexWrap="wrap">
          {extra}
          <Flex gap="10px" ms="auto" flexWrap="wrap">
            <Button leftIcon={<MdContentCopy />} variant="light" onClick={copy}>Copiar</Button>
            <Button as="a" href={waLink(cfg?.negocio, tel, text)} target="_blank" rel="noopener" leftIcon={<FaWhatsapp />} bg="#25D366" color="white" _hover={{ bg: '#1ebe5b' }}>
              Enviar por WhatsApp
            </Button>
          </Flex>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
